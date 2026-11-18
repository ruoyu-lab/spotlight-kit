import { builtinDetectors, collectTypes, normalizeCompletion } from './completion.js';
import { TargetNotFoundError } from './errors.js';
import { isThenable, report, timers } from './runtime.js';
import type {
  Completion,
  Detector,
  DetectorContext,
  Direction,
  LeaveReason,
  StepPhase,
  TargetEnvironment,
  TargetRef,
  Tour,
  TourEvents,
  TourListener,
  TourOptions,
  TourState,
  TourStatus,
  Unsubscribe,
} from './types.js';

/** Used when no environment is given: the reference itself is the handle. */
const identityEnvironment: TargetEnvironment = {
  locate: (ref: TargetRef) => (typeof ref === 'function' ? (ref as () => unknown)() : ref),
  watch: () => () => {},
};

const noop = (): void => {};

function validate(options: TourOptions, detectors: Readonly<Record<string, Detector>>): void {
  const { id, steps } = options;
  if (!id) throw new Error('[spotlight-kit] tour.id is required');
  if (steps.length === 0) throw new Error(`[spotlight-kit] tour "${id}" has no steps`);

  for (const [name, value] of [
    ['waitTimeout', options.waitTimeout],
    ['advanceDelay', options.advanceDelay],
  ] as const) {
    if (value !== undefined && !(value >= 0)) {
      throw new RangeError(`[spotlight-kit] ${name} must be a number >= 0`);
    }
  }

  const seen = new Set<string>();
  for (const step of steps) {
    if (!step.id) throw new Error(`[spotlight-kit] tour "${id}" has a step without id`);
    if (seen.has(step.id)) throw new Error(`[spotlight-kit] duplicate step id "${step.id}" in tour "${id}"`);
    seen.add(step.id);

    if (step.completion !== undefined) {
      for (const type of collectTypes(normalizeCompletion(step.completion))) {
        if (!detectors[type]) {
          throw new Error(`[spotlight-kit] step "${step.id}" uses unknown completion type "${type}"`);
        }
      }
    }
  }
}

/**
 * Creates a tour: a state machine that walks steps, waits for targets,
 * watches completion conditions and tells subscribers what changed. It never
 * touches the DOM; everything environment specific goes through
 * `options.environment` and `options.detectors`.
 */
export function createTour(options: TourOptions): Tour {
  const { id, steps } = options;
  const environment = options.environment ?? identityEnvironment;
  const detectors: Readonly<Record<string, Detector>> = { ...builtinDetectors, ...options.detectors };
  validate(options, detectors);

  const total = steps.length;
  const defaults = {
    waitTimeout: options.waitTimeout ?? 5000,
    onMissing: options.onMissing ?? 'skip',
    advanceDelay: options.advanceDelay ?? 0,
  } as const;

  const listeners = new Set<TourListener>();
  const handlers = new Map<keyof TourEvents, Set<(payload: never) => void>>();

  let status: TourStatus = 'idle';
  let index = 0;
  let phase: StepPhase | null = null;
  let target: unknown = null;
  let targetMissing = false;
  let completed = false;
  let destroyed = false;
  /** Bumped whenever the current step is left. Async work compares against it to detect staleness. */
  let session = 0;
  let teardown: Array<() => void> = [];
  let state = buildState();

  function buildState(): TourState {
    const step = status === 'running' ? (steps[index] ?? null) : null;
    const gated = step !== null && step.completion !== undefined && !completed && step.skippable !== true;
    return Object.freeze({
      id,
      status,
      index,
      total,
      step,
      phase,
      target,
      targetMissing,
      completed,
      isFirst: index === 0,
      isLast: index === total - 1,
      canPrev: status === 'running' && index > 0,
      canNext: status === 'running' && phase === 'active' && !gated,
    });
  }

  function commit(): void {
    state = buildState();
    for (const listener of [...listeners]) {
      try {
        listener(state);
      } catch (error) {
        report(error);
      }
    }
  }

  function emit<K extends keyof TourEvents>(event: K, payload: TourEvents[K]): void {
    const set = handlers.get(event);
    if (!set || set.size === 0) {
      if (event === 'error') report((payload as TourEvents['error']).error);
      return;
    }
    for (const handler of [...set]) {
      try {
        (handler as (p: TourEvents[K]) => void)(payload);
      } catch (error) {
        report(error);
      }
    }
  }

  /** Stops everything belonging to the current step and runs its `afterLeave`. */
  function leave(reason: LeaveReason): void {
    session++;
    const cleanups = teardown;
    teardown = [];
    for (const cleanup of cleanups.reverse()) {
      try {
        cleanup();
      } catch (error) {
        report(error);
      }
    }
    const step = status === 'running' ? steps[index] : undefined;
    if (step?.afterLeave) {
      try {
        const result = step.afterLeave({ index, step, reason });
        if (isThenable(result)) result.then(undefined, report);
      } catch (error) {
        report(error);
      }
    }
  }

  function fail(error: unknown): void {
    const failedAt = index;
    leave('error');
    status = 'idle';
    phase = null;
    target = null;
    targetMissing = false;
    commit();
    emit('error', { error, index: failedAt });
  }

  function finish(): void {
    status = 'finished';
    phase = null;
    target = null;
    targetMissing = false;
    completed = false;
    commit();
    emit('finish', { total });
  }

  /** Leaves the current step and enters `to`. Out of range finishes (or clamps at the start). */
  function go(to: number, direction: Direction, reason: LeaveReason): void {
    const from = index;
    if (to >= total) {
      leave('finish');
      finish();
      return;
    }
    leave(reason);
    if (to < 0) enter(0, 'forward', from, false);
    else enter(to, direction, from, false);
  }

  function enter(to: number, direction: Direction, from: number | null, isStart: boolean): void {
    const step = steps[to];
    const token = ++session;
    status = 'running';
    index = to;
    phase = step.beforeEnter ? 'preparing' : 'locating';
    target = null;
    targetMissing = false;
    completed = false;
    commit();
    if (isStart) emit('start', { index: to });
    emit('step', { index: to, step, previous: from, direction });
    if (token !== session) return; // a listener navigated elsewhere

    if (step.beforeEnter) {
      let pending: unknown;
      try {
        pending = step.beforeEnter({ index: to, step, direction });
      } catch (error) {
        fail(error);
        return;
      }
      if (isThenable(pending)) {
        pending.then(
          () => {
            if (token === session) locateTarget(token, direction);
          },
          (error) => {
            if (token === session) fail(error);
          },
        );
        return;
      }
    }
    locateTarget(token, direction);
  }

  function locateTarget(token: number, direction: Direction): void {
    const step = steps[index];
    if (step.target === undefined) {
      activate(token, null);
      return;
    }
    const ref = step.target;

    if (phase !== 'locating') {
      phase = 'locating';
      commit();
    }

    let found: unknown;
    try {
      found = environment.locate(ref);
    } catch (error) {
      fail(error);
      return;
    }

    // Registered before the first check result is acted on, so no change can slip through.
    // Keeps reporting while active so a re-rendered target is picked up again.
    try {
      teardown.push(
        environment.watch(ref, (handle) => {
          if (token !== session) return;
          if (phase === 'active') {
            target = handle;
            targetMissing = handle == null;
            commit();
          } else if (handle != null) {
            activate(token, handle);
          }
        }),
      );
    } catch (error) {
      fail(error);
      return;
    }

    if (found != null) {
      activate(token, found);
      return;
    }

    const timeout = step.waitTimeout ?? defaults.waitTimeout;
    if (!Number.isFinite(timeout)) return;
    const handle = timers.setTimeout(() => {
      if (token !== session || phase !== 'locating') return;
      const policy = step.onMissing ?? defaults.onMissing;
      if (policy === 'skip') go(direction === 'forward' ? index + 1 : index - 1, direction, 'next');
      else if (policy === 'stop') fail(new TargetNotFoundError(step.id, timeout));
      else activate(token, null);
    }, timeout);
    teardown.push(() => timers.clearTimeout(handle));
  }

  function activate(token: number, handle: unknown): void {
    if (token !== session) return;
    const step = steps[index];
    phase = 'active';
    target = handle;
    targetMissing = step.target !== undefined && handle == null;
    commit();
    if (step.completion === undefined) return;

    let stop: Unsubscribe;
    try {
      stop = startDetector(normalizeCompletion(step.completion), token, () => onComplete(token));
    } catch (error) {
      fail(error);
      return;
    }
    // The condition may already have advanced the tour synchronously.
    if (token !== session) stop();
    else teardown.push(stop);
  }

  function startDetector(completion: Completion, token: number, done: () => void): Unsubscribe {
    const detector = detectors[completion.type];
    if (!detector) throw new Error(`[spotlight-kit] unknown completion type "${completion.type}"`);
    const step = steps[index];

    const context: DetectorContext = {
      step,
      getTarget: () => (token === session ? target : null),
      locate: (ref) => environment.locate(ref),
      watch: (ref, onChange) => environment.watch(ref, onChange),
      complete: () => {
        if (token === session) done();
      },
      start: (child, onChildComplete) => startDetector(child, token, onChildComplete),
      report,
    };
    const stop = detector(completion, context);
    return typeof stop === 'function' ? stop : noop;
  }

  function onComplete(token: number): void {
    if (token !== session || completed) return;
    const step = steps[index];
    completed = true;
    commit();
    emit('complete', { index, step });
    if (token !== session || (step.advance ?? 'auto') !== 'auto') return;

    const wait = step.advanceDelay ?? defaults.advanceDelay;
    if (wait > 0) {
      const handle = timers.setTimeout(() => {
        if (token === session) go(index + 1, 'forward', 'next');
      }, wait);
      teardown.push(() => timers.clearTimeout(handle));
    } else {
      go(index + 1, 'forward', 'next');
    }
  }

  function stop(): void {
    if (status !== 'running') return;
    const stoppedAt = index;
    leave('stop');
    status = 'idle';
    phase = null;
    target = null;
    targetMissing = false;
    completed = false;
    commit();
    emit('stop', { index: stoppedAt });
  }

  function isIndex(value: number): boolean {
    return Number.isInteger(value) && value >= 0 && value < total;
  }

  return {
    id,
    getState: () => state,

    start(from = 0) {
      if (destroyed) return;
      if (!isIndex(from)) {
        throw new RangeError(`[spotlight-kit] start index ${from} is out of range 0..${total - 1}`);
      }
      const wasRunning = status === 'running';
      const previous = wasRunning ? index : null;
      if (wasRunning) leave('goto');
      enter(from, 'forward', previous, true);
    },

    next() {
      if (destroyed || !state.canNext) return false;
      go(index + 1, 'forward', 'next');
      return true;
    },

    skip() {
      if (destroyed || status !== 'running') return false;
      go(index + 1, 'forward', 'next');
      return true;
    },

    prev() {
      if (destroyed || !state.canPrev) return false;
      go(index - 1, 'backward', 'prev');
      return true;
    },

    goTo(to) {
      if (destroyed || status !== 'running' || !isIndex(to) || to === index) return false;
      go(to, to > index ? 'forward' : 'backward', 'goto');
      return true;
    },

    stop,

    destroy() {
      if (destroyed) return;
      stop();
      destroyed = true;
      listeners.clear();
      handlers.clear();
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    on(event, handler) {
      let set = handlers.get(event);
      if (!set) {
        set = new Set();
        handlers.set(event, set);
      }
      const entry = handler as (payload: never) => void;
      set.add(entry);
      return () => {
        set.delete(entry);
      };
    },
  };
}

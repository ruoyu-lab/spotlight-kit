import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { all, any, createTour, delay, when } from './index.js';
import type { Detector, Step, TargetEnvironment, TourOptions } from './index.js';

const steps: Step[] = [
  { id: 'a', title: 'A' },
  { id: 'b', title: 'B' },
  { id: 'c', title: 'C' },
];

/** A fake environment whose targets are toggled by the test. */
function fakeEnvironment() {
  const present = new Map<string, unknown>();
  const watchers = new Map<string, Set<(h: unknown | null) => void>>();
  const environment: TargetEnvironment = {
    locate: (ref) => present.get(String(ref)) ?? null,
    watch(ref, cb) {
      const key = String(ref);
      const set = watchers.get(key) ?? new Set();
      watchers.set(key, set);
      set.add(cb);
      return () => set.delete(cb);
    },
  };
  return {
    environment,
    watcherCount: (key: string) => watchers.get(key)?.size ?? 0,
    show(key: string, handle: unknown = { key }) {
      present.set(key, handle);
      watchers.get(key)?.forEach((cb) => cb(handle));
    },
    hide(key: string) {
      present.delete(key);
      watchers.get(key)?.forEach((cb) => cb(null));
    },
  };
}

function make(options: Partial<TourOptions> & { steps?: Step[] } = {}) {
  return createTour({ id: 'demo', steps, ...options });
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('navigation', () => {
  it('walks forward and back and finishes after the last step', () => {
    const tour = make();
    expect(tour.getState().status).toBe('idle');

    tour.start();
    expect(tour.getState()).toMatchObject({ status: 'running', index: 0, isFirst: true, canPrev: false });
    expect(tour.next()).toBe(true);
    expect(tour.getState().step?.id).toBe('b');
    expect(tour.prev()).toBe(true);
    expect(tour.prev()).toBe(false);

    tour.start(2);
    expect(tour.getState().isLast).toBe(true);
    expect(tour.next()).toBe(true);
    expect(tour.getState()).toMatchObject({ status: 'finished', step: null, phase: null });
  });

  it('goTo respects range and running state', () => {
    const tour = make();
    expect(tour.goTo(1)).toBe(false);
    tour.start();
    expect(tour.goTo(9)).toBe(false);
    expect(tour.goTo(0)).toBe(false);
    expect(tour.goTo(2)).toBe(true);
    expect(tour.getState().index).toBe(2);
  });

  it('start validates the index and can restart a finished tour', () => {
    const tour = make();
    expect(() => tour.start(3)).toThrow(RangeError);
    tour.start(2);
    tour.next();
    expect(tour.getState().status).toBe('finished');
    tour.start();
    expect(tour.getState()).toMatchObject({ status: 'running', index: 0 });
  });

  it('stop returns to idle and is a no-op when not running', () => {
    const tour = make();
    const stop = vi.fn();
    tour.on('stop', stop);
    tour.stop();
    expect(stop).not.toHaveBeenCalled();
    tour.start();
    tour.stop();
    expect(stop).toHaveBeenCalledWith({ index: 0 });
    expect(tour.getState().status).toBe('idle');
  });

  it('state snapshots are immutable and only replaced on change', () => {
    const tour = make();
    const first = tour.getState();
    expect(tour.getState()).toBe(first);
    tour.start();
    expect(tour.getState()).not.toBe(first);
    expect(Object.isFrozen(tour.getState())).toBe(true);
  });

  it('notifies subscribers, supports unsubscribe, and isolates listener errors', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const tour = make();
    const seen: number[] = [];
    const off = tour.subscribe((s) => seen.push(s.index));
    tour.subscribe(() => {
      throw new Error('boom');
    });
    tour.start();
    tour.next();
    off();
    tour.next();
    expect(new Set(seen)).toEqual(new Set([0, 1])); // index 2 arrived after unsubscribe
    error.mockRestore();
  });

  it('emits step events with direction', () => {
    const tour = make();
    const events: Array<[number, string]> = [];
    tour.on('step', (e) => events.push([e.index, e.direction]));
    tour.start();
    tour.next();
    tour.prev();
    expect(events).toEqual([
      [0, 'forward'],
      [1, 'forward'],
      [0, 'backward'],
    ]);
  });

  it('destroy stops the tour and ignores further calls', () => {
    const tour = make();
    tour.start();
    tour.destroy();
    expect(tour.getState().status).toBe('idle');
    tour.start();
    expect(tour.getState().status).toBe('idle');
  });
});

describe('completion', () => {
  it('gates next() until the completion is satisfied, then auto-advances', async () => {
    let ok = false;
    const tour = make({ steps: [{ id: 'a', completion: () => ok }, { id: 'b' }] });
    tour.start();
    expect(tour.getState().canNext).toBe(false);
    expect(tour.next()).toBe(false);

    ok = true;
    vi.advanceTimersByTime(200);
    expect(tour.getState().step?.id).toBe('b');
  });

  it('completes synchronously when the condition is already true', () => {
    const tour = make({ steps: [{ id: 'a', completion: () => true }, { id: 'b' }] });
    tour.start();
    expect(tour.getState().step?.id).toBe('b');
  });

  it('advance: manual marks the step completed and waits for next()', () => {
    const onComplete = vi.fn();
    const tour = make({ steps: [{ id: 'a', completion: () => true, advance: 'manual' }, { id: 'b' }] });
    tour.on('complete', onComplete);
    tour.start();
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(tour.getState()).toMatchObject({ index: 0, completed: true, canNext: true });
    expect(tour.next()).toBe(true);
    expect(tour.getState().step?.id).toBe('b');
  });

  it('skippable steps can be advanced early; skip() always can', () => {
    const tour = make({ steps: [{ id: 'a', completion: () => false, skippable: true }, { id: 'b', completion: () => false }, { id: 'c' }] });
    tour.start();
    expect(tour.next()).toBe(true);
    expect(tour.next()).toBe(false);
    expect(tour.skip()).toBe(true);
    expect(tour.getState().step?.id).toBe('c');
  });

  it('honours advanceDelay', () => {
    const tour = make({ steps: [{ id: 'a', completion: () => true, advanceDelay: 300 }, { id: 'b' }] });
    tour.start();
    expect(tour.getState()).toMatchObject({ index: 0, completed: true });
    vi.advanceTimersByTime(299);
    expect(tour.getState().index).toBe(0);
    vi.advanceTimersByTime(1);
    expect(tour.getState().index).toBe(1);
  });

  it('supports async predicates and survives predicate errors', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    let calls = 0;
    const tour = make({
      steps: [
        {
          id: 'a',
          completion: async () => {
            calls++;
            if (calls === 1) throw new Error('first try fails');
            return calls >= 3;
          },
        },
        { id: 'b' },
      ],
    });
    tour.start();
    await vi.advanceTimersByTimeAsync(1000);
    expect(tour.getState().step?.id).toBe('b');
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it('combinators: any, all, delay, and array shorthand', () => {
    const a = { done: false };
    const b = { done: false };
    const tour = make({
      steps: [
        { id: 'any', completion: any(() => a.done, delay(1000)) },
        { id: 'all', completion: all(() => a.done, () => b.done) },
        { id: 'arr', completion: [() => false, delay(50)] },
        { id: 'end' },
      ],
    });
    tour.start();
    vi.advanceTimersByTime(1000);
    expect(tour.getState().step?.id).toBe('all');
    a.done = true;
    vi.advanceTimersByTime(200);
    expect(tour.getState().step?.id).toBe('all');
    b.done = true;
    vi.advanceTimersByTime(200);
    expect(tour.getState().step?.id).toBe('arr');
    vi.advanceTimersByTime(50);
    expect(tour.getState().step?.id).toBe('end');
  });

  it('runs custom detectors and cleans them up when the step is left', () => {
    const cleanup = vi.fn();
    let complete: () => void = () => {};
    const custom: Detector = (_c, ctx) => {
      complete = ctx.complete;
      return cleanup;
    };
    const tour = make({
      detectors: { custom },
      steps: [{ id: 'a', completion: { type: 'custom' } }, { id: 'b' }],
    });
    tour.start();
    tour.prev();
    tour.skip();
    expect(cleanup).toHaveBeenCalledTimes(1);
    complete(); // stale: must be ignored
    expect(tour.getState().step?.id).toBe('b');
  });

  it('rejects unknown completion types up front', () => {
    expect(() => make({ steps: [{ id: 'a', completion: { type: 'nope' } }] })).toThrow(/unknown completion type "nope"/);
    expect(() => make({ steps: [{ id: 'a', completion: any({ type: 'nope' }) }] })).toThrow(/nope/);
  });

  it('a throwing detector stops the tour and emits error', () => {
    const tour = make({
      detectors: {
        bad: () => {
          throw new Error('bad detector');
        },
      },
      steps: [{ id: 'a', completion: { type: 'bad' } }],
    });
    const onError = vi.fn();
    tour.on('error', onError);
    tour.start();
    expect(tour.getState().status).toBe('idle');
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ index: 0 }));
  });
});

describe('targets', () => {
  it('goes active immediately when the target exists', () => {
    const env = fakeEnvironment();
    env.show('#x');
    const tour = make({ environment: env.environment, steps: [{ id: 'a', target: '#x' }] });
    tour.start();
    expect(tour.getState()).toMatchObject({ phase: 'active', targetMissing: false });
    expect(tour.getState().target).toEqual({ key: '#x' });
  });

  it('waits for a target that appears later', () => {
    const env = fakeEnvironment();
    const tour = make({ environment: env.environment, steps: [{ id: 'a', target: '#x' }] });
    tour.start();
    expect(tour.getState()).toMatchObject({ phase: 'locating', canNext: false });
    vi.advanceTimersByTime(1000);
    env.show('#x');
    expect(tour.getState()).toMatchObject({ phase: 'active', canNext: true });
  });

  it('tracks the target while active (replaced, removed, back again)', () => {
    const env = fakeEnvironment();
    env.show('#x');
    const tour = make({ environment: env.environment, steps: [{ id: 'a', target: '#x' }] });
    tour.start();
    env.hide('#x');
    expect(tour.getState()).toMatchObject({ phase: 'active', target: null, targetMissing: true });
    const replacement = { key: 'new' };
    env.show('#x', replacement);
    expect(tour.getState()).toMatchObject({ target: replacement, targetMissing: false });
  });

  it('skips a missing target after the timeout (forward and backward)', () => {
    const env = fakeEnvironment();
    env.show('#a');
    env.show('#c');
    const tour = make({
      environment: env.environment,
      waitTimeout: 100,
      steps: [{ id: 'a', target: '#a' }, { id: 'b', target: '#missing' }, { id: 'c', target: '#c' }],
    });
    tour.start();
    tour.next();
    expect(tour.getState().step?.id).toBe('b');
    vi.advanceTimersByTime(100);
    expect(tour.getState().step?.id).toBe('c');

    tour.prev();
    vi.advanceTimersByTime(100);
    expect(tour.getState().step?.id).toBe('a');
  });

  it('skipping past the end finishes the tour', () => {
    const env = fakeEnvironment();
    const tour = make({ environment: env.environment, waitTimeout: 10, steps: [{ id: 'a', target: '#nope' }] });
    tour.start();
    vi.advanceTimersByTime(10);
    expect(tour.getState().status).toBe('finished');
  });

  it("onMissing 'show' activates without a target and still follows it later", () => {
    const env = fakeEnvironment();
    const tour = make({
      environment: env.environment,
      waitTimeout: 10,
      steps: [{ id: 'a', target: '#x', onMissing: 'show' }],
    });
    tour.start();
    vi.advanceTimersByTime(10);
    expect(tour.getState()).toMatchObject({ phase: 'active', target: null, targetMissing: true });
    env.show('#x');
    expect(tour.getState()).toMatchObject({ targetMissing: false });
  });

  it("onMissing 'stop' fails with TargetNotFoundError", () => {
    const env = fakeEnvironment();
    const tour = make({
      environment: env.environment,
      waitTimeout: 10,
      steps: [{ id: 'a', target: '#x', onMissing: 'stop' }],
    });
    const onError = vi.fn();
    tour.on('error', onError);
    tour.start();
    vi.advanceTimersByTime(10);
    expect(tour.getState().status).toBe('idle');
    expect(onError.mock.calls[0][0].error.name).toBe('TargetNotFoundError');
  });

  it('waitTimeout: Infinity waits forever', () => {
    const env = fakeEnvironment();
    const tour = make({ environment: env.environment, steps: [{ id: 'a', target: '#x', waitTimeout: Infinity }] });
    tour.start();
    vi.advanceTimersByTime(10 * 60 * 1000);
    expect(tour.getState().phase).toBe('locating');
  });

  it('releases watchers and timers when the step is left', () => {
    const env = fakeEnvironment();
    const tour = make({ environment: env.environment, steps: [{ id: 'a', target: '#x' }, { id: 'b' }] });
    tour.start();
    expect(env.watcherCount('#x')).toBe(1);
    tour.skip();
    expect(env.watcherCount('#x')).toBe(0);
    vi.advanceTimersByTime(60_000);
    expect(tour.getState().step?.id).toBe('b');
  });

  it('without an environment the reference is the handle', () => {
    const el = { name: 'el' };
    const tour = make({ steps: [{ id: 'a', target: el }, { id: 'b', target: () => 'lazy' }] });
    tour.start();
    expect(tour.getState().target).toBe(el);
    tour.next();
    expect(tour.getState().target).toBe('lazy');
  });

  it('a completion condition starts only once the target is there', () => {
    const env = fakeEnvironment();
    const test = vi.fn(() => false);
    const tour = make({ environment: env.environment, steps: [{ id: 'a', target: '#x', completion: test }] });
    tour.start();
    vi.advanceTimersByTime(500);
    expect(test).not.toHaveBeenCalled();
    env.show('#x');
    expect(test).toHaveBeenCalled();
  });
});

describe('hooks', () => {
  it('awaits beforeEnter before locating', async () => {
    const env = fakeEnvironment();
    let release: () => void = () => {};
    const tour = make({
      environment: env.environment,
      steps: [{ id: 'a', target: '#x', beforeEnter: () => new Promise<void>((r) => (release = r)) }],
    });
    env.show('#x');
    tour.start();
    expect(tour.getState().phase).toBe('preparing');
    release();
    await Promise.resolve();
    await Promise.resolve();
    expect(tour.getState().phase).toBe('active');
  });

  it('ignores a stale beforeEnter when the user moved on', async () => {
    let release: () => void = () => {};
    const tour = make({
      steps: [{ id: 'a', beforeEnter: () => new Promise<void>((r) => (release = r)) }, { id: 'b' }],
    });
    tour.start();
    tour.skip();
    release();
    await Promise.resolve();
    await Promise.resolve();
    expect(tour.getState()).toMatchObject({ index: 1, phase: 'active' });
  });

  it('a failing beforeEnter stops the tour with an error', async () => {
    const tour = make({ steps: [{ id: 'a', beforeEnter: () => Promise.reject(new Error('nope')) }] });
    const onError = vi.fn();
    tour.on('error', onError);
    tour.start();
    await Promise.resolve();
    await Promise.resolve();
    expect(onError).toHaveBeenCalled();
    expect(tour.getState().status).toBe('idle');
  });

  it('calls afterLeave with the reason', () => {
    const left: string[] = [];
    const tour = make({
      steps: [
        { id: 'a', afterLeave: (c) => void left.push(`a:${c.reason}`) },
        { id: 'b', afterLeave: (c) => void left.push(`b:${c.reason}`) },
      ],
    });
    tour.start();
    tour.next();
    tour.prev();
    tour.next();
    tour.next();
    expect(left).toEqual(['a:next', 'b:prev', 'a:next', 'b:finish']);
  });
});

describe('validation', () => {
  it('rejects bad definitions', () => {
    expect(() => createTour({ id: '', steps })).toThrow(/id is required/);
    expect(() => createTour({ id: 'x', steps: [] })).toThrow(/no steps/);
    expect(() => createTour({ id: 'x', steps: [{ id: 'a' }, { id: 'a' }] })).toThrow(/duplicate step id/);
    expect(() => createTour({ id: 'x', steps: [{ id: '' }] })).toThrow(/without id/);
    expect(() => createTour({ id: 'x', steps, waitTimeout: -1 })).toThrow(RangeError);
  });

  it('exports builders that produce plain data', () => {
    expect(when(() => true).type).toBe('predicate');
    expect(delay(5)).toEqual({ type: 'delay', ms: 5 });
  });
});

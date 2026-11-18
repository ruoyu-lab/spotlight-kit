export type Unsubscribe = () => void;
export type Awaitable<T> = T | PromiseLike<T>;

/**
 * What a step points at. The core never interprets it: a `TargetEnvironment`
 * turns it into a handle (for the DOM package: a selector, an `Element`, or a
 * function returning an `Element`).
 */
export type TargetRef = string | object | (() => unknown);

/** Popover placement hint for renderers. */
export type Placement = 'auto' | 'top' | 'bottom' | 'left' | 'right';

export type Direction = 'forward' | 'backward';
export type LeaveReason = 'next' | 'prev' | 'goto' | 'stop' | 'finish' | 'error';

/** What to do when a step's target does not show up within `waitTimeout`. */
export type MissingPolicy = 'skip' | 'show' | 'stop';

/**
 * A completion condition. `type` selects a detector; the other keys are that
 * detector's options. The core ships `predicate`, `any`, `all` and `delay`;
 * `@spotlight-kit/dom` adds DOM based ones. Use the builder functions
 * (`when`, `any`, `all`, `delay`, ...) instead of writing these by hand.
 */
export interface Completion {
  readonly type: string;
  readonly [option: string]: unknown;
}

/** Anything accepted by `Step.completion`: a condition, a predicate, or a list (any of them). */
export type CompletionInput = Completion | (() => Awaitable<boolean>) | readonly CompletionInput[];

export interface EnterContext {
  readonly index: number;
  readonly step: Step;
  readonly direction: Direction;
}

export interface LeaveContext {
  readonly index: number;
  readonly step: Step;
  readonly reason: LeaveReason;
}

/** A single step of a tour. Plain data plus optional hooks. */
export interface Step {
  /** Unique within its tour. */
  id: string;
  title?: string;
  /** Plain text body. Renderers must not interpret it as HTML. */
  body?: string;

  /** The thing to point at. Omit for a centered, target-less step. */
  target?: TargetRef;
  /** Renderer hint. */
  placement?: Placement;
  /** Renderer hint: can the user operate the highlighted area? Default `true`. */
  interactive?: boolean;

  /**
   * When this step counts as done. With a completion the step cannot be
   * advanced by `next()` until it is satisfied (unless `skippable`).
   */
  completion?: CompletionInput;
  /** What happens once `completion` is satisfied. Default `'auto'`. */
  advance?: 'auto' | 'manual';
  /** Milliseconds to wait before auto-advancing. Falls back to the tour option. */
  advanceDelay?: number;
  /** Allow `next()` before the completion is satisfied. */
  skippable?: boolean;

  /** How long to wait for `target` to appear. `Infinity` waits forever. */
  waitTimeout?: number;
  onMissing?: MissingPolicy;

  /** Runs before the target is looked up, e.g. to open a menu or change route. May be async. */
  beforeEnter?(context: EnterContext): Awaitable<void>;
  /** Runs when the step is left for any reason. Not awaited. */
  afterLeave?(context: LeaveContext): Awaitable<void>;

  /** Anything else your app wants to carry on a step. */
  data?: Record<string, unknown>;
}

/**
 * Bridge between target references and the outside world. The core stays
 * environment free by delegating all lookups here.
 */
export interface TargetEnvironment {
  /** Synchronously resolves a reference, `null` when it is not (yet) available. */
  locate(ref: TargetRef): unknown | null;
  /**
   * Reports every change of the resolved handle (appear, disappear, replaced).
   * Must not call back for the state that exists at the time of the call.
   */
  watch(ref: TargetRef, onChange: (handle: unknown | null) => void): Unsubscribe;
}

export interface DetectorContext {
  readonly step: Step;
  /** The current handle of the step's target, `null` while there is none. */
  getTarget(): unknown | null;
  locate(ref: TargetRef): unknown | null;
  watch(ref: TargetRef, onChange: (handle: unknown | null) => void): Unsubscribe;
  /** Signals that the condition is satisfied. Safe to call more than once. */
  complete(): void;
  /** Starts a nested condition (for combinators). */
  start(completion: Completion, onComplete: () => void): Unsubscribe;
  /** Reports a non-fatal error without stopping the tour. */
  report(error: unknown): void;
}

/**
 * Watches for one kind of completion. Start listening, call `ctx.complete()`
 * when satisfied, and return a function that stops listening. Throwing aborts the tour.
 */
export type Detector<C extends Completion = Completion> = (completion: C, context: DetectorContext) => Unsubscribe | void;

export type TourStatus = 'idle' | 'running' | 'finished';
/** `preparing`: running `beforeEnter`. `locating`: waiting for the target. `active`: showing. */
export type StepPhase = 'preparing' | 'locating' | 'active';

/** Immutable snapshot. A new object is created for every change. */
export interface TourState {
  readonly id: string;
  readonly status: TourStatus;
  readonly index: number;
  readonly total: number;
  /** The current step while running, otherwise `null`. */
  readonly step: Step | null;
  readonly phase: StepPhase | null;
  /** Current target handle, `null` when there is none (yet). */
  readonly target: unknown | null;
  /** The step has a target but it is not available right now. */
  readonly targetMissing: boolean;
  /** The current step's completion is satisfied. */
  readonly completed: boolean;
  readonly isFirst: boolean;
  readonly isLast: boolean;
  readonly canPrev: boolean;
  /** Whether `next()` would move on right now. */
  readonly canNext: boolean;
}

export type TourListener = (state: TourState) => void;

export interface TourEvents {
  start: { index: number };
  step: { index: number; step: Step; previous: number | null; direction: Direction };
  complete: { index: number; step: Step };
  finish: { total: number };
  stop: { index: number };
  error: { error: unknown; index: number };
}

export interface TourOptions {
  id: string;
  steps: readonly Step[];
  /** Resolves and watches targets. Defaults to an identity environment (the ref is the handle). */
  environment?: TargetEnvironment;
  /** Extra completion detectors, keyed by `Completion.type`. */
  detectors?: Readonly<Record<string, Detector>>;
  /** Default `waitTimeout` for steps. Default 5000 ms. */
  waitTimeout?: number;
  /** Default `onMissing` for steps. Default `'skip'`. */
  onMissing?: MissingPolicy;
  /** Default `advanceDelay` for steps. Default 0. */
  advanceDelay?: number;
}

export interface Tour {
  readonly id: string;
  getState(): TourState;
  /** Starts (or restarts) the tour at `index`. */
  start(index?: number): void;
  /** Moves on, or finishes after the last step. Returns false when refused (see `canNext`). */
  next(): boolean;
  /** Like `next()` but ignores an unsatisfied completion. */
  skip(): boolean;
  prev(): boolean;
  goTo(index: number): boolean;
  /** Ends the tour without finishing it. */
  stop(): void;
  /** Stops and removes every listener. The tour cannot be used afterwards. */
  destroy(): void;
  subscribe(listener: TourListener): Unsubscribe;
  on<K extends keyof TourEvents>(event: K, handler: (payload: TourEvents[K]) => void): Unsubscribe;
}

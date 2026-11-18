/**
 * A single step of a tutorial. Pure data: the core never reads `target`
 * or `placement`; renderers decide what they mean.
 */
export interface TutorialStep {
  /** Unique within its tutorial. */
  id: string;
  title: string;
  /** Plain text body. Renderers should escape it. */
  body?: string;
  /** Renderer hint, e.g. a CSS selector of the element to spotlight. */
  target?: string;
  /** Renderer hint for where the popover goes relative to the target. */
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
  /** Any extra data your app wants to attach to a step. */
  data?: Record<string, unknown>;
}

export interface Tutorial {
  id: string;
  title?: string;
  steps: readonly TutorialStep[];
}

/** Anything with the `localStorage` shape works (window.localStorage, sessionStorage, custom). */
export interface TutorialStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export type TutorialStatus = 'idle' | 'running' | 'finished';

export interface TutorialState {
  status: TutorialStatus;
  /** Current step index. Meaningful while running or finished. */
  index: number;
  total: number;
  /** Current step while running, otherwise null. */
  step: TutorialStep | null;
  isFirst: boolean;
  isLast: boolean;
}

export type TutorialListener = (state: TutorialState) => void;

export interface CreateTutorialOptions {
  tutorial: Tutorial;
  /** Optional persistence of the current step index. */
  storage?: TutorialStorage;
  /** Defaults to `tutorial:<tutorial.id>`. */
  storageKey?: string;
}

export interface TutorialController {
  getState(): TutorialState;
  /** Starts (or restarts) the tutorial. Resumes from storage when no index is given. */
  start(index?: number): void;
  /** Returns false when already on the last step, which finishes the tutorial. */
  next(): boolean;
  prev(): boolean;
  /** Jumps to a step while running. Returns false when not running or out of range. */
  goTo(index: number): boolean;
  /** Pauses and keeps progress in storage so start() can resume. */
  stop(): void;
  /** Stops and clears saved progress. */
  reset(): void;
  subscribe(listener: TutorialListener): () => void;
}

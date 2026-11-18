/**
 * The core has no DOM and no Node typings, yet it needs timers and a place to
 * report errors. Resolve them from `globalThis` at call time so test fakes work.
 */
interface Host {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
  setInterval(fn: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
  console?: { error(...args: unknown[]): void };
}

const host = (): Host => globalThis as unknown as Host;

export const timers = {
  setTimeout: (fn: () => void, ms: number): unknown => host().setTimeout(fn, ms),
  clearTimeout: (handle: unknown): void => host().clearTimeout(handle),
  setInterval: (fn: () => void, ms: number): unknown => host().setInterval(fn, ms),
  clearInterval: (handle: unknown): void => host().clearInterval(handle),
};

/** Errors that must not break the engine (listener or hook failures). */
export function report(error: unknown): void {
  host().console?.error('[spotlight-kit]', error);
}

export function isThenable(value: unknown): value is PromiseLike<unknown> {
  return typeof value === 'object' && value !== null && typeof (value as { then?: unknown }).then === 'function';
}

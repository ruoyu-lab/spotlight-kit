import { isThenable, timers } from './runtime.js';
import type { Awaitable, Completion, CompletionInput, Detector } from './types.js';

/** Completes once `test` returns (or resolves to) a truthy value. Polled every `interval` ms. */
export function when(test: () => Awaitable<boolean>, options: { interval?: number } = {}): Completion {
  return { type: 'predicate', test, interval: options.interval };
}

/** Completes when any of the conditions completes. */
export function any(...items: CompletionInput[]): Completion {
  return { type: 'any', of: items.map(normalizeCompletion) };
}

/** Completes when all of the conditions have completed (in any order). */
export function all(...items: CompletionInput[]): Completion {
  return { type: 'all', of: items.map(normalizeCompletion) };
}

/** Completes after `ms` milliseconds. */
export function delay(ms: number): Completion {
  return { type: 'delay', ms };
}

export function normalizeCompletion(input: CompletionInput): Completion {
  if (typeof input === 'function') return when(input);
  if (Array.isArray(input)) return any(...(input as readonly CompletionInput[]));
  return input as Completion;
}

/** Every `type` used by a completion tree, for validation. */
export function collectTypes(completion: Completion, into: Set<string> = new Set()): Set<string> {
  into.add(completion.type);
  const children = completion.of;
  if (Array.isArray(children)) for (const child of children) collectTypes(child as Completion, into);
  return into;
}

const predicate: Detector = (completion, ctx) => {
  const test = completion.test as () => Awaitable<boolean>;
  const interval = (completion.interval as number | undefined) ?? 200;
  let stopped = false;
  let busy = false;

  const check = (): void => {
    if (stopped || busy) return;
    let result: Awaitable<boolean>;
    try {
      result = test();
    } catch (error) {
      ctx.report(error);
      return;
    }
    if (isThenable(result)) {
      busy = true;
      result.then(
        (value) => {
          busy = false;
          if (value && !stopped) ctx.complete();
        },
        (error) => {
          busy = false;
          ctx.report(error);
        },
      );
    } else if (result) {
      ctx.complete();
    }
  };

  check();
  if (stopped) return;
  const handle = timers.setInterval(check, interval);
  return () => {
    stopped = true;
    timers.clearInterval(handle);
  };
};

const delayDetector: Detector = (completion, ctx) => {
  const handle = timers.setTimeout(() => ctx.complete(), completion.ms as number);
  return () => timers.clearTimeout(handle);
};

const anyDetector: Detector = (completion, ctx) => {
  const stops = (completion.of as Completion[]).map((child) => ctx.start(child, ctx.complete));
  return () => stops.forEach((stop) => stop());
};

const allDetector: Detector = (completion, ctx) => {
  const children = completion.of as Completion[];
  const done = new Set<number>();
  const stops = children.map((child, i) =>
    ctx.start(child, () => {
      done.add(i);
      if (done.size === children.length) ctx.complete();
    }),
  );
  return () => stops.forEach((stop) => stop());
};

export const builtinDetectors: Readonly<Record<string, Detector>> = {
  predicate,
  delay: delayDetector,
  any: anyDetector,
  all: allDetector,
};

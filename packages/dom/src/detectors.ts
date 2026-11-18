import type { Completion, Detector, DetectorContext, TargetRef } from '@spotlight-kit/core';
import { isElement } from './environment.js';

/**
 * DOM completion conditions. Every builder takes an optional `target`; when
 * omitted the step's own target is used. Targets are re-resolved on every
 * check, so conditions keep working when the framework re-renders the element.
 */

type ValueMatcher = RegExp | string | ((value: string) => boolean);

export interface EventOptions {
  /** Extra filter, called with the event and the resolved target. */
  filter?: (event: Event, element: Element) => boolean;
}

/** Any DOM event that happens on (or inside) the target. */
export function event(name: string, target?: TargetRef, options: EventOptions = {}): Completion {
  return { type: 'event', event: name, target, filter: options.filter };
}

export const click = (target?: TargetRef): Completion => event('click', target);
export const change = (target?: TargetRef): Completion => event('change', target);
export const submit = (target?: TargetRef): Completion => event('submit', target);

function matches(value: string, matcher: ValueMatcher | undefined): boolean {
  if (matcher === undefined) return value.length > 0;
  if (typeof matcher === 'string') return value === matcher;
  if (typeof matcher === 'function') return matcher(value);
  matcher.lastIndex = 0;
  return matcher.test(value);
}

/**
 * The user typed into the target. With `match` the value must also satisfy it
 * (string: equal, RegExp: test, function: predicate); without it any non-empty value counts.
 */
export function input(target?: TargetRef, match?: ValueMatcher): Completion {
  return event('input', target, {
    filter: (_event, element) => matches((element as HTMLInputElement).value ?? '', match),
  });
}

/** The target is present (and visible). */
export function appears(target?: TargetRef): Completion {
  return { type: 'appear', target };
}

/** The target is gone. Completes immediately when it is already absent. */
export function disappears(target?: TargetRef): Completion {
  return { type: 'disappear', target };
}

/** Completes when `test` returns true for the resolved target. Re-checked on DOM changes and input. */
export function elementState(target: TargetRef | undefined, test: (element: Element) => boolean): Completion {
  return { type: 'state', target, test };
}

/** An attribute of the target equals `expected` (any value when omitted). */
export function attr(target: TargetRef | undefined, name: string, expected?: ValueMatcher): Completion {
  return elementState(target, (el) => {
    const value = el.getAttribute(name);
    return value !== null && (expected === undefined || matches(value, expected));
  });
}

export function hasClass(target: TargetRef | undefined, className: string): Completion {
  return elementState(target, (el) => el.classList.contains(className));
}

function refOf(completion: Completion, ctx: DetectorContext): TargetRef {
  const ref = (completion.target as TargetRef | undefined) ?? ctx.step.target;
  if (ref === undefined) {
    throw new Error(`[spotlight-kit] completion "${completion.type}" needs a target (step "${ctx.step.id}" has none)`);
  }
  return ref;
}

/** Detectors for the completion types above, bound to a document. */
export function createDomDetectors(doc: Document): Readonly<Record<string, Detector>> {
  const view = doc.defaultView;
  const MutationObserverImpl = view?.MutationObserver ?? MutationObserver;

  const eventDetector: Detector = (completion, ctx) => {
    const ref = refOf(completion, ctx);
    const name = completion.event as string;
    const filter = completion.filter as EventOptions['filter'];
    let pending: ReturnType<typeof setTimeout> | undefined;

    const handler = (e: Event): void => {
      // Text typed through an IME (pinyin, kana, ...) is only a draft until the composition ends.
      if ((e as InputEvent).isComposing) return;
      const element = ctx.locate(ref);
      if (!isElement(element) || !e.composedPath().includes(element)) return;
      // Decide later, so the page's own handlers run first and the filter sees the final value.
      clearTimeout(pending);
      pending = setTimeout(() => {
        if (!filter || filter(e, element)) ctx.complete();
      }, 0);
    };

    doc.addEventListener(name, handler, true);
    // The last `input` of a composition still reports isComposing, so the commit is only visible here.
    const listenToCommit = name === 'input';
    if (listenToCommit) doc.addEventListener('compositionend', handler, true);
    return () => {
      clearTimeout(pending);
      doc.removeEventListener(name, handler, true);
      if (listenToCommit) doc.removeEventListener('compositionend', handler, true);
    };
  };

  const appearDetector: Detector = (completion, ctx) => {
    const ref = refOf(completion, ctx);
    if (ctx.locate(ref) != null) {
      ctx.complete();
      return;
    }
    return ctx.watch(ref, (handle) => {
      if (handle != null) ctx.complete();
    });
  };

  const disappearDetector: Detector = (completion, ctx) => {
    const ref = refOf(completion, ctx);
    if (ctx.locate(ref) == null) {
      ctx.complete();
      return;
    }
    return ctx.watch(ref, (handle) => {
      if (handle == null) ctx.complete();
    });
  };

  const stateDetector: Detector = (completion, ctx) => {
    const ref = refOf(completion, ctx);
    const test = completion.test as (element: Element) => boolean;
    const check = (): void => {
      const element = ctx.locate(ref);
      if (isElement(element) && test(element)) ctx.complete();
    };

    const onInput = (e: Event): void => {
      if (!(e as InputEvent).isComposing) check();
    };
    const onCompositionEnd = (): void => {
      clearTimeout(pending);
      pending = setTimeout(check, 0); // the committed value is in place by then
    };
    let pending: ReturnType<typeof setTimeout> | undefined;

    const observer = new MutationObserverImpl(check);
    observer.observe(doc, { subtree: true, childList: true, attributes: true, characterData: true });
    // Form values are properties, not attributes, so mutations alone would miss them.
    doc.addEventListener('input', onInput, true);
    doc.addEventListener('change', check, true);
    doc.addEventListener('compositionend', onCompositionEnd, true);
    check();
    return () => {
      clearTimeout(pending);
      observer.disconnect();
      doc.removeEventListener('input', onInput, true);
      doc.removeEventListener('change', check, true);
      doc.removeEventListener('compositionend', onCompositionEnd, true);
    };
  };

  return {
    event: eventDetector,
    appear: appearDetector,
    disappear: disappearDetector,
    state: stateDetector,
  };
}

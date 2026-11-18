import type { Unsubscribe } from '@spotlight-kit/core';
import { fromDOMRect, isFullyVisible, sameRect, type Rect, type Size } from './geometry.js';

function viewOf(element: Element): Window {
  const view = element.ownerDocument.defaultView;
  if (!view) throw new Error('[spotlight-kit] element is not attached to a window');
  return view;
}

export function viewportSize(view: Window): Size {
  return { width: view.innerWidth, height: view.innerHeight };
}

/**
 * Reports the element's viewport rectangle now and whenever it changes. It
 * polls once per animation frame, which also catches movement that fires no
 * event (transforms, sibling layout shifts, scrolling in any ancestor).
 */
export function trackRect(element: Element, onChange: (rect: Rect) => void): Unsubscribe {
  const view = viewOf(element);
  let last: Rect | null = null;
  let frame = 0;
  let active = true;

  const tick = (): void => {
    if (!active) return;
    const rect = fromDOMRect(element.getBoundingClientRect());
    if (!last || !sameRect(last, rect)) {
      last = rect;
      onChange(rect);
      if (!active) return;
    }
    frame = view.requestAnimationFrame(tick);
  };
  tick();

  return () => {
    active = false;
    view.cancelAnimationFrame(frame);
  };
}

/** Scrolls the element into view unless it is already fully visible. */
export function scrollIntoViewIfNeeded(element: Element, behavior: 'auto' | 'smooth' = 'smooth', margin = 8): void {
  const view = viewOf(element);
  const rect = fromDOMRect(element.getBoundingClientRect());
  const viewport = viewportSize(view);
  if (isFullyVisible(rect, viewport, margin) || typeof element.scrollIntoView !== 'function') return;

  const reduceMotion = view.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  element.scrollIntoView({
    block: rect.height > viewport.height - margin * 2 ? 'start' : 'center',
    inline: 'nearest',
    behavior: reduceMotion ? 'auto' : behavior,
  });
}

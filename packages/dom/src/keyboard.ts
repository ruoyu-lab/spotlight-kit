import type { Tour, Unsubscribe } from '@spotlight-kit/core';

export interface KeyboardOptions {
  document?: Document;
  /** Escape stops the tour. Default true. */
  closeOnEscape?: boolean;
}

function isEditable(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || el.nodeType !== 1) return false;
  return el.isContentEditable || /^(input|textarea|select)$/i.test(el.tagName);
}

/**
 * Escape closes, arrow keys navigate. Ignored while the user types into a
 * form control or uses modifier keys, so it never fights the page.
 */
export function bindKeyboard(tour: Tour, options: KeyboardOptions = {}): Unsubscribe {
  const doc = options.document ?? document;
  const closeOnEscape = options.closeOnEscape ?? true;

  const onKeyDown = (e: KeyboardEvent): void => {
    if (tour.getState().status !== 'running' || e.defaultPrevented) return;
    if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;

    if (e.key === 'Escape') {
      if (closeOnEscape) tour.stop();
      return;
    }
    if (isEditable(e.target)) return;
    if (e.key === 'ArrowRight') tour.next();
    else if (e.key === 'ArrowLeft') tour.prev();
  };

  doc.addEventListener('keydown', onKeyDown);
  return () => doc.removeEventListener('keydown', onKeyDown);
}

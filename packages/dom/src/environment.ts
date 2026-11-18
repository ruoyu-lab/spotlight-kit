import type { TargetEnvironment, TargetRef } from '@spotlight-kit/core';

/** Marks nodes owned by spotlight-kit so its own DOM changes never trigger target re-checks. */
export const ROOT_ATTRIBUTE = 'data-spotlight-kit-root';

export interface DomEnvironmentOptions {
  /** Defaults to the global `document`. */
  document?: Document;
  /**
   * Decides whether an element counts as present. Defaults to "attached, has
   * layout, and not `visibility: hidden`", so targets inside collapsed or
   * `display: none` containers are treated as not there yet.
   */
  isVisible?: (element: Element) => boolean;
}

export interface DomEnvironment extends TargetEnvironment {
  readonly document: Document;
}

export function isElement(value: unknown): value is Element {
  return typeof value === 'object' && value !== null && (value as Node).nodeType === 1;
}

function defaultIsVisible(element: Element): boolean {
  if (!element.isConnected || element.getClientRects().length === 0) return false;
  const view = element.ownerDocument.defaultView;
  return !view || view.getComputedStyle(element).visibility !== 'hidden';
}

function isOwnNode(node: Node | null): boolean {
  const element = node && node.nodeType === 1 ? (node as Element) : (node?.parentElement ?? null);
  return element?.closest?.(`[${ROOT_ATTRIBUTE}]`) != null;
}

/**
 * Resolves selectors, elements and getter functions to visible elements and
 * watches the document for changes (appear, disappear, replaced).
 */
export function createDomEnvironment(options: DomEnvironmentOptions = {}): DomEnvironment {
  const doc = options.document ?? document;
  const isVisible = options.isVisible ?? defaultIsVisible;

  const resolve = (ref: TargetRef): Element | null => {
    let found: unknown;
    if (typeof ref === 'string') found = doc.querySelector(ref);
    else if (typeof ref === 'function') found = (ref as () => unknown)();
    else found = ref;
    return isElement(found) && isVisible(found) ? found : null;
  };

  return {
    document: doc,
    locate: resolve,
    watch(ref, onChange) {
      let last = resolve(ref);
      const check = (): void => {
        const next = resolve(ref);
        if (next === last) return;
        last = next;
        onChange(next);
      };

      const view = doc.defaultView;
      const observer = new (view?.MutationObserver ?? MutationObserver)((records) => {
        if (records.every((record) => isOwnNode(record.target))) return;
        check();
      });
      observer.observe(doc, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style', 'hidden', 'open', 'aria-hidden'],
      });
      view?.addEventListener('resize', check);

      return () => {
        observer.disconnect();
        view?.removeEventListener('resize', check);
      };
    },
  };
}

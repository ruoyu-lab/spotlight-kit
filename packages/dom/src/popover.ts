import type { Tour, TourState } from '@spotlight-kit/core';
import type { Labels } from './labels.js';

/**
 * A popover implementation. The renderer positions `element`
 * (`transform`, `data-side`, `--sk-arrow`) and calls `update` on every state
 * change. Provide your own factory to replace the default markup entirely.
 */
export interface PopoverView {
  readonly element: HTMLElement;
  update(state: TourState): void;
  destroy(): void;
}

export interface PopoverContext {
  document: Document;
  tour: Tour;
  labels: Labels;
}

export type PopoverFactory = (context: PopoverContext) => PopoverView;

let counter = 0;

/** Up to this many steps the progress is drawn as dots, beyond it as text. */
export const PROGRESS_DOTS_MAX = 8;

/** Path of the close "x" in a 14x14 box, shared with framework bindings. */
export const CLOSE_ICON_PATH = 'M3.5 3.5l7 7M10.5 3.5l-7 7';

export function createCloseIcon(doc: Document): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = doc.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 14 14');
  svg.setAttribute('width', '14');
  svg.setAttribute('height', '14');
  svg.setAttribute('aria-hidden', 'true');
  const path = doc.createElementNS(ns, 'path');
  path.setAttribute('d', CLOSE_ICON_PATH);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '1.6');
  path.setAttribute('stroke-linecap', 'round');
  svg.append(path);
  return svg;
}

export const createDefaultPopover: PopoverFactory = ({ document: doc, tour, labels }) => {
  const uid = `sk-${++counter}`;
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] => {
    const node = doc.createElement(tag);
    node.className = className;
    return node;
  };

  const root = el('div', 'sk-popover');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-labelledby', `${uid}-title`);
  root.setAttribute('aria-describedby', `${uid}-body`);
  root.tabIndex = -1;

  const arrow = el('div', 'sk-arrow');
  const close = el('button', 'sk-close');
  close.type = 'button';
  close.append(createCloseIcon(doc));
  close.setAttribute('aria-label', labels.close);

  const title = el('h3', 'sk-title');
  title.id = `${uid}-title`;
  const body = el('p', 'sk-body');
  body.id = `${uid}-body`;

  const footer = el('div', 'sk-footer');
  const progress = el('span', 'sk-progress');
  const prev = el('button', 'sk-btn');
  prev.type = 'button';
  prev.textContent = labels.prev;
  const next = el('button', 'sk-btn sk-btn-primary');
  next.type = 'button';

  footer.append(progress, prev, next);
  root.append(arrow, close, title, body, footer);

  const onClose = (): void => tour.stop();
  const onPrev = (): void => void tour.prev();
  const onNext = (): void => void tour.next();
  close.addEventListener('click', onClose);
  prev.addEventListener('click', onPrev);
  next.addEventListener('click', onNext);

  return {
    element: root,

    update(state) {
      const step = state.step;
      if (!step) return;
      title.textContent = step.title ?? '';
      title.hidden = !step.title;
      body.textContent = step.body ?? '';
      body.hidden = !step.body;
      renderProgress(doc, progress, state.index, state.total, labels);
      prev.hidden = state.isFirst;
      next.textContent = state.isLast ? labels.finish : labels.next;
      next.disabled = !state.canNext;
    },

    destroy() {
      close.removeEventListener('click', onClose);
      prev.removeEventListener('click', onPrev);
      next.removeEventListener('click', onNext);
      root.remove();
    },
  };
};

function renderProgress(doc: Document, container: HTMLElement, index: number, total: number, labels: Labels): void {
  container.textContent = '';
  if (total <= 1) return;
  const text = labels.progress(index + 1, total);
  if (total > PROGRESS_DOTS_MAX) {
    container.textContent = text;
    return;
  }
  for (let i = 0; i < total; i++) {
    const dot = doc.createElement('i');
    dot.className = 'sk-dot';
    dot.setAttribute('data-s', i < index ? 'done' : i === index ? 'current' : 'todo');
    dot.setAttribute('aria-hidden', 'true');
    container.append(dot);
  }
  const sr = doc.createElement('span');
  sr.className = 'sk-sr';
  sr.textContent = text; // dots are decoration; screen readers get "2 / 5"
  container.append(sr);
}

import type { Tour, TourState } from '@spotlight-kit/core';
import { ROOT_ATTRIBUTE } from './environment.js';
import { bindKeyboard } from './keyboard.js';
import { en, type Labels } from './labels.js';
import { createOverlay } from './overlay.js';
import { createDefaultPopover, type PopoverFactory } from './popover.js';
import { createStage, type StageLayout } from './stage.js';
import { ensureStyles, removeStylesIfUnused } from './styles.js';

export interface RendererOptions {
  /** Defaults to the global `document`. */
  document?: Document;
  /** Where the overlay is mounted. Defaults to `document.body`. */
  root?: HTMLElement;
  /** Space between the target and the edge of the highlight, in px. Default 8. */
  padding?: number;
  /** Corner radius of the highlight, in px. Default 8. */
  radius?: number;
  /** Space between the highlight and the popover, in px. Default 12. */
  gap?: number;
  /** Dimming color. Default `rgba(15, 23, 42, 0.6)`. */
  overlayColor?: string;
  /** Duration of the glide between steps (highlight and popover together), in ms. 0 disables it. Default 260. */
  animationMs?: number;
  /** How to scroll the target into view. `false` disables scrolling. Default `'smooth'`. */
  scroll?: 'auto' | 'smooth' | false;
  labels?: Partial<Labels>;
  /** Arrow keys and Escape. Default true. */
  keyboard?: boolean;
  closeOnEscape?: boolean;
  /** Clicking the dimmed area stops the tour. Default false. */
  closeOnOverlayClick?: boolean;
  /** Replace the default popover. */
  popover?: PopoverFactory;
}

export interface Renderer {
  destroy(): void;
}

/**
 * Draws a tour with plain DOM: dimmed overlay with a hole, a popover with
 * title, text and buttons, keyboard support, focus handling.
 */
export function mountRenderer(tour: Tour, options: RendererOptions = {}): Renderer {
  const doc = options.document ?? document;
  const parent = options.root ?? doc.body;
  const labels: Labels = { ...en, ...options.labels };

  ensureStyles(doc);
  const root = doc.createElement('div');
  root.className = 'sk-root';
  root.setAttribute(ROOT_ATTRIBUTE, '');
  root.hidden = true;
  parent.append(root);

  const popover = (options.popover ?? createDefaultPopover)({ document: doc, tour, labels });
  const popoverEl = popover.element;
  popoverEl.classList.add('sk-in');
  popoverEl.style.visibility = 'hidden';

  const overlay = createOverlay({
    document: doc,
    container: root,
    color: options.overlayColor ?? 'rgba(15, 23, 42, 0.6)',
    onBackdropClick: options.closeOnOverlayClick ? () => tour.stop() : undefined,
  });
  root.append(popoverEl); // after the overlay, so it stacks on top

  const stage = createStage({
    document: doc,
    overlay,
    padding: options.padding ?? 8,
    radius: options.radius ?? 8,
    gap: options.gap ?? 12,
    scroll: options.scroll ?? 'smooth',
    animationMs: options.animationMs ?? 260,
    measurePopover: () => {
      const { width, height } = popoverEl.getBoundingClientRect();
      return { width, height };
    },
    onLayout: (layout: StageLayout) => {
      popoverEl.style.visibility = layout.visible ? 'visible' : 'hidden';
      if (!layout.visible) return;
      popoverEl.style.transform = `translate(${Math.round(layout.x)}px, ${Math.round(layout.y)}px)`;
      popoverEl.setAttribute('data-side', layout.side);
      popoverEl.style.setProperty('--sk-arrow', `${Math.round(layout.arrow)}px`);
    },
  });

  const stopKeyboard =
    options.keyboard === false ? null : bindKeyboard(tour, { document: doc, closeOnEscape: options.closeOnEscape });

  let lastFocused: Element | null = null;
  let shownStep: string | null = null;

  const render = (state: TourState): void => {
    const active = state.status === 'running' && state.phase === 'active' && state.step !== null;
    root.hidden = !active;

    if (!active) {
      shownStep = null;
      stage.update(state);
      if (lastFocused && lastFocused.isConnected && popoverEl.contains(doc.activeElement)) {
        (lastFocused as HTMLElement).focus?.({ preventScroll: true });
      }
      lastFocused = null;
      return;
    }

    popover.update(state);
    stage.update(state);

    // Move focus into the dialog once per step, unless the user is meant to operate the page.
    const key = `${state.id}:${state.index}`;
    if (key !== shownStep) {
      shownStep = key;
      if (!lastFocused) lastFocused = doc.activeElement;
      if (state.step!.completion === undefined) popoverEl.focus({ preventScroll: true });
    }
  };

  const unsubscribe = tour.subscribe(render);
  render(tour.getState());

  return {
    destroy() {
      unsubscribe();
      stopKeyboard?.();
      stage.destroy();
      popover.destroy();
      root.remove();
      removeStylesIfUnused(doc, ROOT_ATTRIBUTE);
    },
  };
}

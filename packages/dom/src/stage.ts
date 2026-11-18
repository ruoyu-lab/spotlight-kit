import type { Step, TourState, Unsubscribe } from '@spotlight-kit/core';
import { isElement } from './environment.js';
import { computePlacement, inflate, type Rect, type Side, type Size } from './geometry.js';
import type { Overlay } from './overlay.js';
import { scrollIntoViewIfNeeded, trackRect, viewportSize } from './tracker.js';

export interface StageLayout {
  visible: boolean;
  /** Top-left of the popover in viewport coordinates. */
  x: number;
  y: number;
  side: Side | 'center';
  /** Arrow offset along the popover's edge. */
  arrow: number;
}

export interface StageOptions {
  document: Document;
  overlay: Overlay;
  padding: number;
  radius: number;
  gap: number;
  scroll: 'auto' | 'smooth' | false;
  /** Current popover size, `null` when it is not rendered. */
  measurePopover(): Size | null;
  onLayout(layout: StageLayout): void;
}

export interface Stage {
  /** Feed every tour state change here. */
  update(state: TourState): void;
  /** Recompute placement, e.g. after the popover's content changed size. */
  relayout(): void;
  destroy(): void;
}

const HIDDEN: StageLayout = { visible: false, x: 0, y: 0, side: 'center', arrow: 0 };

/**
 * Everything between "the tour is on step N" and "here is where things go":
 * scrolls the target into view, follows it as it moves, drives the overlay
 * and works out where the popover belongs. Renderer agnostic: the popover
 * itself is drawn by whoever consumes `onLayout` (plain DOM, Vue, ...).
 */
export function createStage(options: StageOptions): Stage {
  const { overlay, onLayout } = options;
  const view = options.document.defaultView!;

  let step: Step | null = null;
  let stepKey = '';
  let tracked: Element | null = null;
  let rect: Rect | null = null;
  let stopTracking: Unsubscribe | null = null;
  let wasVisible = false;
  let animateNext = false;

  const layout = (): void => {
    if (!step) return;
    const spot = rect ? inflate(rect, options.padding) : null;
    overlay.show(spot ? { rect: spot, radius: options.radius, interactive: step.interactive !== false } : null, animateNext);
    animateNext = false;

    const placement = computePlacement({
      target: spot,
      popover: options.measurePopover() ?? { width: 0, height: 0 },
      viewport: viewportSize(view),
      preferred: step.placement,
      gap: options.gap,
    });
    onLayout({ visible: true, ...placement });
  };

  const stopTrack = (): void => {
    stopTracking?.();
    stopTracking = null;
  };

  const hide = (): void => {
    stopTrack();
    overlay.hide();
    step = null;
    stepKey = '';
    tracked = null;
    rect = null;
    wasVisible = false;
    onLayout(HIDDEN);
  };

  const onResize = (): void => layout();
  view.addEventListener('resize', onResize);

  return {
    update(state) {
      if (state.status !== 'running' || state.phase !== 'active' || !state.step) {
        hide();
        return;
      }

      const element = isElement(state.target) ? state.target : null;
      const key = `${state.id}:${state.index}`;
      const stepChanged = key !== stepKey;
      step = state.step;

      if (!stepChanged && element === tracked) {
        layout();
        return;
      }

      stopTrack();
      animateNext = wasVisible && stepChanged;
      stepKey = key;
      tracked = element;
      wasVisible = true;

      if (!element) {
        rect = null;
        layout();
        return;
      }
      if (options.scroll !== false) scrollIntoViewIfNeeded(element, options.scroll);
      stopTracking = trackRect(element, (next) => {
        rect = next;
        layout();
      });
    },

    relayout: layout,

    destroy() {
      view.removeEventListener('resize', onResize);
      stopTrack();
      overlay.destroy();
    },
  };
}

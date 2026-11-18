import type { Step, TourState, Unsubscribe } from '@spotlight-kit/core';
import { isElement } from './environment.js';
import {
  computePlacement,
  easeOutCubic,
  inflate,
  lerpPlacement,
  lerpRect,
  type PlacementResult,
  type Rect,
  type Side,
  type Size,
} from './geometry.js';
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
  /** Duration of the glide between two steps in ms. 0 disables it. */
  animationMs: number;
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

interface Glide {
  start: number;
  fromRect: Rect | null;
  fromPlace: PlacementResult | null;
}

/**
 * Everything between "the tour is on step N" and "here is where things go":
 * scrolls the target into view, follows it as it moves, drives the overlay
 * and works out where the popover belongs. Renderer agnostic: the popover
 * itself is drawn by whoever consumes `onLayout` (plain DOM, Vue, React, ...).
 *
 * Between two steps the highlight and the popover glide together. Both are
 * derived from the same eased progress value, so they never drift apart, and
 * the glide chases the target if it keeps moving (smooth scrolling).
 */
export function createStage(options: StageOptions): Stage {
  const { overlay, onLayout } = options;
  const view = options.document.defaultView!;
  const reduceMotion = view.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const duration = reduceMotion ? 0 : options.animationMs;

  let step: Step | null = null;
  let stepKey = '';
  let tracked: Element | null = null;
  /** Where the highlight should end up (already padded). `null`: no target. */
  let goal: Rect | null = null;
  /** What was drawn last, the starting point of the next glide. */
  let shown: { rect: Rect | null; place: PlacementResult } | null = null;
  let glide: Glide | null = null;
  let frame = 0;
  let stopTracking: Unsubscribe | null = null;
  let wasVisible = false;

  const render = (): void => {
    if (!step) return;
    const progress = glide ? Math.min(1, (view.performance.now() - glide.start) / duration) : 1;
    const eased = easeOutCubic(progress);

    const target = computePlacement({
      target: goal,
      popover: options.measurePopover() ?? { width: 0, height: 0 },
      viewport: viewportSize(view),
      preferred: step.placement,
      gap: options.gap,
    });
    const place = glide?.fromPlace ? lerpPlacement(glide.fromPlace, target, eased) : target;
    const rect = goal && glide?.fromRect ? lerpRect(glide.fromRect, goal, eased) : goal;

    overlay.show(rect ? { rect, radius: options.radius, interactive: step.interactive !== false } : null);
    shown = { rect, place };
    onLayout({ visible: true, ...place });

    if (progress >= 1) glide = null;
  };

  const tick = (): void => {
    render();
    if (glide) frame = view.requestAnimationFrame(tick);
  };

  const startGlide = (): void => {
    view.cancelAnimationFrame(frame);
    glide = { start: view.performance.now(), fromRect: shown?.rect ?? null, fromPlace: shown?.place ?? null };
    frame = view.requestAnimationFrame(tick);
  };

  const stopTrack = (): void => {
    stopTracking?.();
    stopTracking = null;
  };

  const hide = (): void => {
    stopTrack();
    view.cancelAnimationFrame(frame);
    glide = null;
    shown = null;
    overlay.hide();
    step = null;
    stepKey = '';
    tracked = null;
    goal = null;
    wasVisible = false;
    onLayout(HIDDEN);
  };

  const onResize = (): void => render();
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
        render();
        return;
      }

      stopTrack();
      if (stepChanged && wasVisible && duration > 0) startGlide();
      stepKey = key;
      tracked = element;
      wasVisible = true;

      if (!element) {
        goal = null;
        render();
        return;
      }
      if (options.scroll !== false) scrollIntoViewIfNeeded(element, options.scroll);
      stopTracking = trackRect(element, (rect) => {
        goal = inflate(rect, options.padding);
        render();
      });
    },

    relayout: render,

    destroy() {
      view.removeEventListener('resize', onResize);
      stopTrack();
      view.cancelAnimationFrame(frame);
      overlay.destroy();
    },
  };
}

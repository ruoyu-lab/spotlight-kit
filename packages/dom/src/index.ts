import { createTour, type Tour, type TourOptions } from '@spotlight-kit/core';
import { createDomDetectors } from './detectors.js';
import { createDomEnvironment, type DomEnvironmentOptions } from './environment.js';
import { mountRenderer, type RendererOptions } from './renderer.js';

export interface DomPlatform {
  environment: ReturnType<typeof createDomEnvironment>;
  detectors: ReturnType<typeof createDomDetectors>;
}

/**
 * The DOM side of a tour: target lookup/watching and the DOM completion
 * detectors. Spread it into `createTour` to drive a tour with your own UI:
 *
 *   createTour({ ...createDomPlatform(), id, steps })
 */
export function createDomPlatform(options: DomEnvironmentOptions = {}): DomPlatform {
  const environment = createDomEnvironment(options);
  return { environment, detectors: createDomDetectors(environment.document) };
}

export type SpotlightOptions = Omit<TourOptions, 'environment'> & {
  /** Only needed to override the defaults, e.g. for tests. */
  environment?: DomEnvironmentOptions;
};

/**
 * The batteries-included entry point: a tour wired to the DOM and drawn with
 * the default overlay and popover. `destroy()` removes everything it mounted.
 */
export function createSpotlight(options: SpotlightOptions, ui: RendererOptions = {}): Tour {
  const { environment: environmentOptions, detectors, ...tourOptions } = options;
  const platform = createDomPlatform({ document: ui.document, ...environmentOptions });
  const tour = createTour({
    ...tourOptions,
    environment: platform.environment,
    detectors: { ...platform.detectors, ...detectors },
  });
  const renderer = mountRenderer(tour, { document: platform.environment.document, ...ui });

  return {
    ...tour,
    destroy() {
      renderer.destroy();
      tour.destroy();
    },
  };
}

export { appears, attr, change, click, disappears, elementState, event, hasClass, input, submit } from './detectors.js';
export type { EventOptions } from './detectors.js';
export { createDomDetectors } from './detectors.js';
export { createDomEnvironment, isElement, ROOT_ATTRIBUTE } from './environment.js';
export type { DomEnvironment, DomEnvironmentOptions } from './environment.js';
export { bindKeyboard } from './keyboard.js';
export type { KeyboardOptions } from './keyboard.js';
export { en, zhCN } from './labels.js';
export type { Labels } from './labels.js';
export { createOverlay } from './overlay.js';
export type { Overlay, OverlayOptions, Spot } from './overlay.js';
export { CLOSE_ICON_PATH, PROGRESS_DOTS_MAX, createCloseIcon, createDefaultPopover } from './popover.js';
export type { PopoverContext, PopoverFactory, PopoverView } from './popover.js';
export { mountRenderer } from './renderer.js';
export type { Renderer, RendererOptions } from './renderer.js';
export { createStage } from './stage.js';
export type { Stage, StageLayout, StageOptions } from './stage.js';
export { ensureStyles } from './styles.js';
export { scrollIntoViewIfNeeded, trackRect, viewportSize } from './tracker.js';
export { computePlacement, holePath, inflate } from './geometry.js';
export type { PlacementInput, PlacementResult, Rect, Side, Size } from './geometry.js';

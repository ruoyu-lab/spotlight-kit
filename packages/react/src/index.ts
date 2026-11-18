export { useTour } from './use-tour.js';
export type { UseTour } from './use-tour.js';
export { SpotlightTour } from './SpotlightTour.js';
export type { SpotlightRenderProps, SpotlightTourProps } from './SpotlightTour.js';

// The most common companions, so a React app needs one import line.
export { createSpotlight, createDomPlatform, appears, attr, change, click, disappears, event, hasClass, input, submit, zhCN, en } from '@spotlight-kit/dom';
export { createTour, all, any, delay, when } from '@spotlight-kit/core';
export type { Step, Tour, TourOptions, TourState } from '@spotlight-kit/core';

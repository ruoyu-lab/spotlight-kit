import { useMemo, useSyncExternalStore } from 'react';
import type { Tour, TourState } from '@spotlight-kit/core';

export interface UseTour {
  /** Immutable snapshot of the tour. A new object on every change. */
  state: TourState;
  start: Tour['start'];
  next: Tour['next'];
  skip: Tour['skip'];
  prev: Tour['prev'];
  goTo: Tour['goTo'];
  stop: Tour['stop'];
}

/**
 * Subscribes a component to a tour. Concurrent-rendering safe
 * (`useSyncExternalStore`). The tour is not destroyed on unmount: it may
 * outlive the component.
 */
export function useTour(tour: Tour): UseTour {
  const state = useSyncExternalStore(tour.subscribe, tour.getState, tour.getState);
  const actions = useMemo(
    () => ({
      start: (index?: number) => tour.start(index),
      next: () => tour.next(),
      skip: () => tour.skip(),
      prev: () => tour.prev(),
      goTo: (index: number) => tour.goTo(index),
      stop: () => tour.stop(),
    }),
    [tour],
  );
  return { state, ...actions };
}

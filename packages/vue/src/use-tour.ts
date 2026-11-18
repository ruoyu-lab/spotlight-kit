import { computed, onScopeDispose, shallowRef, type ComputedRef } from 'vue';
import type { Tour, TourState } from '@spotlight-kit/core';

export interface UseTour {
  /** Reactive snapshot of the tour. Replaced (never mutated) on every change. */
  state: ComputedRef<TourState>;
  start: Tour['start'];
  next: Tour['next'];
  skip: Tour['skip'];
  prev: Tour['prev'];
  goTo: Tour['goTo'];
  stop: Tour['stop'];
}

/**
 * Binds a tour to Vue reactivity. The subscription ends automatically when
 * the surrounding effect scope (usually a component) is disposed. The tour
 * itself is not destroyed: it may outlive the component.
 */
export function useTour(tour: Tour): UseTour {
  const snapshot = shallowRef<TourState>(tour.getState());
  const unsubscribe = tour.subscribe((next) => {
    snapshot.value = next;
  });
  onScopeDispose(unsubscribe);

  return {
    state: computed(() => snapshot.value),
    start: (index) => tour.start(index),
    next: () => tour.next(),
    skip: () => tour.skip(),
    prev: () => tour.prev(),
    goTo: (index) => tour.goTo(index),
    stop: () => tour.stop(),
  };
}

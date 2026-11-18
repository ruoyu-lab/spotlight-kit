import { onScopeDispose, readonly, shallowRef } from 'vue';
import type { TutorialController, TutorialState } from '@tutorial-kit/core';

/**
 * Binds a tutorial controller to Vue reactivity. Subscription is removed
 * automatically when the surrounding effect scope (e.g. a component) is disposed.
 */
export function useTutorial(controller: TutorialController) {
  const state = shallowRef<TutorialState>(controller.getState());
  const unsubscribe = controller.subscribe((next) => {
    state.value = next;
  });
  onScopeDispose(unsubscribe);

  return {
    state: readonly(state),
    start: (index?: number) => controller.start(index),
    next: () => controller.next(),
    prev: () => controller.prev(),
    goTo: (index: number) => controller.goTo(index),
    stop: () => controller.stop(),
    reset: () => controller.reset(),
  };
}

export type { TutorialController, TutorialState, Tutorial, TutorialStep } from '@tutorial-kit/core';

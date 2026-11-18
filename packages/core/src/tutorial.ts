import type {
  CreateTutorialOptions,
  Tutorial,
  TutorialController,
  TutorialListener,
  TutorialState,
  TutorialStatus,
  TutorialStorage,
} from './types';

function validate(tutorial: Tutorial): void {
  if (!tutorial.id) {
    throw new Error('[tutorial-kit] tutorial.id is required');
  }
  if (tutorial.steps.length === 0) {
    throw new Error(`[tutorial-kit] tutorial "${tutorial.id}" has no steps`);
  }
  const seen = new Set<string>();
  for (const step of tutorial.steps) {
    if (!step.id) {
      throw new Error(`[tutorial-kit] tutorial "${tutorial.id}" has a step without id`);
    }
    if (seen.has(step.id)) {
      throw new Error(`[tutorial-kit] duplicate step id "${step.id}" in "${tutorial.id}"`);
    }
    seen.add(step.id);
  }
}

function readSavedIndex(storage: TutorialStorage | undefined, key: string, total: number): number | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (raw === null) return null;
    const n = Number.parseInt(raw, 10);
    return Number.isInteger(n) && n >= 0 && n < total ? n : null;
  } catch {
    // Storage can throw (private mode, blocked site data). Progress is optional.
    return null;
  }
}

function writeIndex(storage: TutorialStorage | undefined, key: string, index: number): void {
  try {
    storage?.setItem(key, String(index));
  } catch {
    /* ignore: persistence is best-effort */
  }
}

/**
 * Creates a tutorial controller. It holds state and emits changes, and it
 * never touches the DOM, so any UI (HTML, Vue, React, canvas, CLI) can drive it.
 */
export function createTutorial(options: CreateTutorialOptions): TutorialController {
  const { tutorial, storage } = options;
  validate(tutorial);

  const storageKey = options.storageKey ?? `tutorial:${tutorial.id}`;
  const total = tutorial.steps.length;
  const listeners = new Set<TutorialListener>();

  let status: TutorialStatus = 'idle';
  let index = 0;

  const getState = (): TutorialState => ({
    status,
    index,
    total,
    step: status === 'running' ? (tutorial.steps[index] ?? null) : null,
    isFirst: index === 0,
    isLast: index === total - 1,
  });

  const emit = (): void => {
    const state = getState();
    for (const listener of listeners) listener(state);
  };

  const setIndex = (next: number): void => {
    index = next;
    writeIndex(storage, storageKey, index);
  };

  return {
    getState,

    start(from) {
      const target = from ?? readSavedIndex(storage, storageKey, total) ?? 0;
      if (!Number.isInteger(target) || target < 0 || target >= total) {
        throw new RangeError(`[tutorial-kit] start index ${target} is out of range 0..${total - 1}`);
      }
      status = 'running';
      setIndex(target);
      emit();
    },

    next() {
      if (status !== 'running') return false;
      if (index < total - 1) {
        setIndex(index + 1);
        emit();
        return true;
      }
      status = 'finished';
      emit();
      return false;
    },

    prev() {
      if (status !== 'running' || index === 0) return false;
      setIndex(index - 1);
      emit();
      return true;
    },

    goTo(target) {
      if (status !== 'running' || !Number.isInteger(target) || target < 0 || target >= total) {
        return false;
      }
      setIndex(target);
      emit();
      return true;
    },

    stop() {
      if (status === 'idle') return;
      status = 'idle';
      emit();
    },

    reset() {
      status = 'idle';
      index = 0;
      try {
        storage?.removeItem?.(storageKey);
      } catch {
        /* ignore */
      }
      emit();
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

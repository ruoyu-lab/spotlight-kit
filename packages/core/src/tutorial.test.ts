import { describe, expect, it } from 'vitest';
import { createTutorial } from './tutorial';
import type { TutorialStorage } from './types';

const tutorial = {
  id: 'intro',
  steps: [
    { id: 'a', title: 'A', target: '#a' },
    { id: 'b', title: 'B' },
    { id: 'c', title: 'C' },
  ],
};

function memoryStorage(): TutorialStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

describe('createTutorial', () => {
  it('starts idle and walks forward and back', () => {
    const t = createTutorial({ tutorial });
    expect(t.getState().status).toBe('idle');

    t.start();
    expect(t.getState()).toMatchObject({ status: 'running', index: 0, isFirst: true, isLast: false });
    expect(t.getState().step?.id).toBe('a');

    expect(t.next()).toBe(true);
    expect(t.getState().step?.id).toBe('b');
    expect(t.prev()).toBe(true);
    expect(t.getState().index).toBe(0);
    expect(t.prev()).toBe(false);
  });

  it('finishes when next() passes the last step', () => {
    const t = createTutorial({ tutorial });
    t.start(2);
    expect(t.getState().isLast).toBe(true);
    expect(t.next()).toBe(false);
    expect(t.getState()).toMatchObject({ status: 'finished', step: null });
  });

  it('goTo only works while running and inside range', () => {
    const t = createTutorial({ tutorial });
    expect(t.goTo(1)).toBe(false);
    t.start();
    expect(t.goTo(5)).toBe(false);
    expect(t.goTo(2)).toBe(true);
    expect(t.getState().index).toBe(2);
  });

  it('notifies subscribers and supports unsubscribe', () => {
    const t = createTutorial({ tutorial });
    const seen: number[] = [];
    const off = t.subscribe((s) => seen.push(s.index));
    t.start();
    t.next();
    off();
    t.next();
    expect(seen).toEqual([0, 1]);
  });

  it('persists progress and resumes from storage', () => {
    const storage = memoryStorage();
    const first = createTutorial({ tutorial, storage });
    first.start();
    first.next();
    first.stop();

    const second = createTutorial({ tutorial, storage });
    second.start();
    expect(second.getState().index).toBe(1);
    expect(storage.data.get('tutorial:intro')).toBe('1');
  });

  it('ignores invalid saved progress', () => {
    const storage = memoryStorage();
    storage.setItem('tutorial:intro', '99');
    const t = createTutorial({ tutorial, storage });
    t.start();
    expect(t.getState().index).toBe(0);
  });

  it('reset clears saved progress', () => {
    const storage = memoryStorage();
    const t = createTutorial({ tutorial, storage });
    t.start(2);
    t.reset();
    expect(storage.data.has('tutorial:intro')).toBe(false);
    expect(t.getState().status).toBe('idle');
  });

  it('survives a storage that throws', () => {
    const broken: TutorialStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    const t = createTutorial({ tutorial, storage: broken });
    expect(() => t.start()).not.toThrow();
    expect(t.getState().index).toBe(0);
  });

  it('rejects invalid tutorials', () => {
    expect(() => createTutorial({ tutorial: { id: 'x', steps: [] } })).toThrow(/no steps/);
    expect(() =>
      createTutorial({
        tutorial: {
          id: 'x',
          steps: [
            { id: 'same', title: '1' },
            { id: 'same', title: '2' },
          ],
        },
      }),
    ).toThrow(/duplicate step id/);
  });
});

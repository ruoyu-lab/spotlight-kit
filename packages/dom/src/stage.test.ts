// @vitest-environment happy-dom
import type { TourState } from '@spotlight-kit/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { computePlacement } from './geometry';
import type { Overlay, Spot } from './overlay';
import { createStage, type StageLayout } from './stage';

let clock = 0;
let queue = new Map<number, () => void>();
let nextId = 1;

function runFrames(times: number[]): void {
  for (const t of times) {
    clock = t;
    const batch = [...queue.values()];
    queue.clear();
    batch.forEach((cb) => cb());
  }
}

function elementAt(x: number, y: number, width = 80, height = 30): HTMLElement {
  const el = document.createElement('div');
  document.body.append(el);
  el.getBoundingClientRect = () => ({ x, y, left: x, top: y, width, height, right: x + width, bottom: y + height }) as DOMRect;
  return el;
}

const state = (index: number, target: Element | null): TourState =>
  ({
    id: 't',
    status: 'running',
    phase: 'active',
    index,
    step: { id: `s${index}` },
    target,
  }) as unknown as TourState;

beforeEach(() => {
  clock = 0;
  queue = new Map();
  window.requestAnimationFrame = (cb) => {
    const id = nextId++;
    queue.set(id, () => cb(clock));
    return id;
  };
  window.cancelAnimationFrame = (id) => void queue.delete(id);
  window.performance.now = () => clock;
  document.body.innerHTML = '';
});
afterEach(() => {
  document.body.innerHTML = '';
});

function setup(animationMs: number) {
  const spots: Array<Spot | null> = [];
  const layouts: StageLayout[] = [];
  const overlay: Overlay = { show: (s) => void spots.push(s), hide: () => {}, destroy: () => {} };
  const stage = createStage({
    document,
    overlay,
    padding: 0,
    radius: 4,
    gap: 12,
    scroll: false,
    animationMs,
    measurePopover: () => ({ width: 200, height: 100 }),
    onLayout: (l) => layouts.push(l),
  });
  return { stage, spots, layouts };
}

describe('stage glide', () => {
  it('moves the highlight and the popover together between steps and lands exactly on the target', () => {
    const a = elementAt(100, 100);
    const b = elementAt(500, 400);
    const { stage, spots, layouts } = setup(200);

    stage.update(state(0, a));
    expect(spots.at(-1)!.rect).toMatchObject({ x: 100, y: 100 });

    stage.update(state(1, b));
    const startX = spots.at(-1)!.rect.x;
    expect(startX).toBeCloseTo(100, 0); // begins where the previous step was

    const rectXs: number[] = [startX];
    const popXs: number[] = [layouts.at(-1)!.x];
    for (const t of [50, 100, 150, 200]) {
      runFrames([t]);
      rectXs.push(spots.at(-1)!.rect.x);
      popXs.push(layouts.at(-1)!.x);
    }

    // strictly progressing, never overshooting
    for (let i = 1; i < rectXs.length; i++) {
      expect(rectXs[i]).toBeGreaterThan(rectXs[i - 1]);
      expect(popXs[i]).toBeGreaterThanOrEqual(popXs[i - 1]);
    }
    expect(rectXs.at(-1)).toBeCloseTo(500, 5);

    const final = computePlacement({ target: { x: 500, y: 400, width: 80, height: 30 }, popover: { width: 200, height: 100 }, viewport: { width: window.innerWidth, height: window.innerHeight }, gap: 12 });
    expect(layouts.at(-1)).toMatchObject({ x: final.x, y: final.y, side: final.side });

    expect(queue.size).toBe(1); // only the target tracker's poll is left: the glide loop has stopped
  });

  it('chases a target that keeps moving during the glide', () => {
    const a = elementAt(100, 100);
    let bx = 500;
    const b = elementAt(500, 400);
    b.getBoundingClientRect = () => ({ x: bx, y: 400, left: bx, top: 400, width: 80, height: 30, right: bx + 80, bottom: 430 }) as DOMRect;
    const { stage, spots } = setup(200);
    stage.update(state(0, a));
    stage.update(state(1, b));
    runFrames([100]);
    bx = 700; // e.g. smooth scrolling shifts it
    runFrames([200, 216]);
    expect(spots.at(-1)!.rect.x).toBeCloseTo(700, 5);
  });

  it('does not animate the very first appearance, nor when animationMs is 0', () => {
    const a = elementAt(100, 100);
    const b = elementAt(500, 400);
    const first = setup(200);
    first.stage.update(state(0, a));
    expect(queue.size).toBe(1); // just the tracker, no glide
    first.stage.destroy();

    const instant = setup(0);
    instant.stage.update(state(0, a));
    instant.stage.update(state(1, b));
    expect(instant.spots.at(-1)!.rect.x).toBe(500);
    expect(queue.size).toBe(1);
  });

  it('hides when the tour is not showing a step', () => {
    const { stage, layouts } = setup(200);
    stage.update({ ...state(0, null), phase: 'locating' } as TourState);
    expect(layouts.at(-1)!.visible).toBe(false);
  });
});

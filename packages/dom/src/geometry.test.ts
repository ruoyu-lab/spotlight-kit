import { describe, expect, it } from 'vitest';
import { computePlacement, holePath, inflate, isFullyVisible, lerpRect, sameRect } from './geometry.js';

const viewport = { width: 1000, height: 800 };
const popover = { width: 300, height: 150 };

describe('holePath', () => {
  it('dims everything without a hole', () => {
    expect(holePath(viewport, null, 8)).toBe('M0 0H1000V800H0Z');
    expect(holePath(viewport, { x: 0, y: 0, width: 0, height: 10 }, 8)).toBe('M0 0H1000V800H0Z');
  });

  it('cuts a rounded rectangle', () => {
    const d = holePath(viewport, { x: 100, y: 100, width: 200, height: 50 }, 8);
    expect(d.startsWith('M0 0H1000V800H0Z')).toBe(true);
    expect(d).toContain('M108 100H292A8 8 0 0 1 300 108');
    expect(d.endsWith('Z')).toBe(true);
  });

  it('clamps the radius to half the smaller side', () => {
    expect(holePath(viewport, { x: 0, y: 0, width: 20, height: 10 }, 99)).toContain('A5 5');
  });
});

describe('rect helpers', () => {
  it('inflate, sameRect, lerpRect, isFullyVisible', () => {
    expect(inflate({ x: 10, y: 10, width: 20, height: 20 }, 5)).toEqual({ x: 5, y: 5, width: 30, height: 30 });
    expect(sameRect({ x: 0, y: 0, width: 1, height: 1 }, { x: 0.2, y: 0, width: 1, height: 1 })).toBe(true);
    expect(sameRect({ x: 0, y: 0, width: 1, height: 1 }, { x: 2, y: 0, width: 1, height: 1 })).toBe(false);
    expect(lerpRect({ x: 0, y: 0, width: 10, height: 10 }, { x: 10, y: 20, width: 30, height: 10 }, 0.5)).toEqual({
      x: 5,
      y: 10,
      width: 20,
      height: 10,
    });
    expect(isFullyVisible({ x: 10, y: 10, width: 100, height: 100 }, viewport, 8)).toBe(true);
    expect(isFullyVisible({ x: 10, y: 750, width: 100, height: 100 }, viewport, 8)).toBe(false);
  });
});

describe('computePlacement', () => {
  const target = { x: 400, y: 300, width: 100, height: 40 };

  it('centers without a target', () => {
    expect(computePlacement({ target: null, popover, viewport })).toEqual({ x: 350, y: 325, side: 'center', arrow: 0 });
  });

  it('prefers below and centers horizontally on the target', () => {
    const p = computePlacement({ target, popover, viewport });
    expect(p).toMatchObject({ side: 'bottom', x: 300, y: 352 });
    expect(p.arrow).toBe(150); // target center (450) minus x (300)
  });

  it('honours the preferred side when it fits', () => {
    expect(computePlacement({ target, popover, viewport, preferred: 'top' }).side).toBe('top');
    expect(computePlacement({ target, popover, viewport, preferred: 'right' })).toMatchObject({ side: 'right', x: 512 });
  });

  it('flips when the preferred side has no room', () => {
    const low = { x: 400, y: 740, width: 100, height: 40 };
    expect(computePlacement({ target: low, popover, viewport }).side).toBe('top');
    expect(computePlacement({ target: low, popover, viewport, preferred: 'bottom' }).side).toBe('top');
  });

  it('clamps into the viewport and keeps the arrow on the target', () => {
    const corner = { x: 0, y: 0, width: 40, height: 40 };
    const p = computePlacement({ target: corner, popover, viewport });
    expect(p.x).toBe(8);
    expect(p.arrow).toBe(14); // target center (20) - x (8) = 12, raised to the 14px inset
    const far = computePlacement({ target: { x: 960, y: 400, width: 40, height: 40 }, popover, viewport });
    expect(far.x + popover.width).toBeLessThanOrEqual(viewport.width - 8);
  });

  it('falls back to the side with the most room when nothing fits', () => {
    const tiny = { width: 300, height: 200 };
    const huge = { x: 20, y: 20, width: 260, height: 160 };
    const p = computePlacement({ target: huge, popover: { width: 280, height: 150 }, viewport: tiny });
    expect(['top', 'bottom', 'left', 'right']).toContain(p.side);
    expect(p.x).toBeGreaterThanOrEqual(8);
    expect(p.y).toBeGreaterThanOrEqual(8);
  });
});

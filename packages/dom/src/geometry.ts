import type { Placement } from '@spotlight-kit/core';

/** Pure geometry helpers. Nothing here touches the DOM, so all of it is unit-testable. */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export type Side = 'top' | 'bottom' | 'left' | 'right';

export function fromDOMRect(r: { left: number; top: number; width: number; height: number }): Rect {
  return { x: r.left, y: r.top, width: r.width, height: r.height };
}

export function inflate(rect: Rect, amount: number): Rect {
  return { x: rect.x - amount, y: rect.y - amount, width: rect.width + amount * 2, height: rect.height + amount * 2 };
}

export function sameRect(a: Rect, b: Rect, epsilon = 0.5): boolean {
  return (
    Math.abs(a.x - b.x) < epsilon &&
    Math.abs(a.y - b.y) < epsilon &&
    Math.abs(a.width - b.width) < epsilon &&
    Math.abs(a.height - b.height) < epsilon
  );
}

export function lerpRect(a: Rect, b: Rect, t: number): Rect {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    width: a.width + (b.width - a.width) * t,
    height: a.height + (b.height - a.height) * t,
  };
}

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function isFullyVisible(rect: Rect, viewport: Size, margin = 0): boolean {
  return (
    rect.x >= margin &&
    rect.y >= margin &&
    rect.x + rect.width <= viewport.width - margin &&
    rect.y + rect.height <= viewport.height - margin
  );
}

const fmt = (n: number): string => String(Math.round(n * 100) / 100);

/**
 * SVG path (use with `fill-rule: evenodd`) that covers the whole viewport
 * except a rounded rectangle. With no hole it dims everything.
 */
export function holePath(viewport: Size, hole: Rect | null, radius: number): string {
  const outer = `M0 0H${fmt(viewport.width)}V${fmt(viewport.height)}H0Z`;
  if (!hole || hole.width <= 0 || hole.height <= 0) return outer;

  const { x, y, width: w, height: h } = hole;
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  const arc = `A${fmt(r)} ${fmt(r)} 0 0 1`;
  const inner =
    `M${fmt(x + r)} ${fmt(y)}` +
    `H${fmt(x + w - r)}${arc} ${fmt(x + w)} ${fmt(y + r)}` +
    `V${fmt(y + h - r)}${arc} ${fmt(x + w - r)} ${fmt(y + h)}` +
    `H${fmt(x + r)}${arc} ${fmt(x)} ${fmt(y + h - r)}` +
    `V${fmt(y + r)}${arc} ${fmt(x + r)} ${fmt(y)}Z`;
  return outer + inner;
}

export interface PlacementInput {
  /** The highlighted rectangle (already padded). `null` centers the popover. */
  target: Rect | null;
  popover: Size;
  viewport: Size;
  preferred?: Placement;
  /** Distance between target and popover. Default 12. */
  gap?: number;
  /** Minimum distance to the viewport edge. Default 8. */
  margin?: number;
}

export interface PlacementResult {
  /** Top-left corner of the popover in viewport coordinates. */
  x: number;
  y: number;
  /** The side of the target the popover sits on. */
  side: Side | 'center';
  /** Offset of the arrow along the popover's edge, measured from its top-left. */
  arrow: number;
}

const ORDER: readonly Side[] = ['bottom', 'top', 'right', 'left'];
const ARROW_INSET = 14;

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), Math.max(min, max));

/**
 * Picks a side for the popover: the preferred one if it fits, otherwise the
 * first of bottom, top, right, left that fits, otherwise the one that
 * overflows the least. The result is clamped into the viewport.
 */
export function computePlacement(input: PlacementInput): PlacementResult {
  const { target, popover: p, viewport: v } = input;
  const gap = input.gap ?? 12;
  const margin = input.margin ?? 8;

  if (!target) {
    return {
      x: clamp((v.width - p.width) / 2, margin, v.width - p.width - margin),
      y: clamp((v.height - p.height) / 2, margin, v.height - p.height - margin),
      side: 'center',
      arrow: 0,
    };
  }

  const room: Record<Side, number> = {
    top: target.y - margin - (p.height + gap),
    bottom: v.height - (target.y + target.height) - margin - (p.height + gap),
    left: target.x - margin - (p.width + gap),
    right: v.width - (target.x + target.width) - margin - (p.width + gap),
  };

  const preferred = input.preferred && input.preferred !== 'auto' ? input.preferred : undefined;
  const candidates = preferred ? [preferred, ...ORDER.filter((s) => s !== preferred)] : ORDER;
  const side =
    candidates.find((s) => room[s] >= 0) ?? ORDER.reduce((best, s) => (room[s] > room[best] ? s : best), ORDER[0]);

  const centerX = target.x + target.width / 2;
  const centerY = target.y + target.height / 2;
  const maxX = v.width - p.width - margin;
  const maxY = v.height - p.height - margin;

  if (side === 'top' || side === 'bottom') {
    const x = clamp(centerX - p.width / 2, margin, maxX);
    const y = clamp(side === 'bottom' ? target.y + target.height + gap : target.y - gap - p.height, margin, maxY);
    return { x, y, side, arrow: clamp(centerX - x, ARROW_INSET, p.width - ARROW_INSET) };
  }

  const y = clamp(centerY - p.height / 2, margin, maxY);
  const x = clamp(side === 'right' ? target.x + target.width + gap : target.x - gap - p.width, margin, maxX);
  return { x, y, side, arrow: clamp(centerY - y, ARROW_INSET, p.height - ARROW_INSET) };
}

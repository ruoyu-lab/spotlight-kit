import { holePath, type Rect } from './geometry.js';

export interface Spot {
  /** The area to leave undimmed, already padded. */
  rect: Rect;
  radius: number;
  /** When false the hole is covered by an invisible blocker so the target cannot be operated. */
  interactive: boolean;
}

export interface OverlayOptions {
  document: Document;
  /** The overlay's SVG is appended here. */
  container: HTMLElement;
  color: string;
  onBackdropClick?: () => void;
}

export interface Overlay {
  /** Dims the page except `spot`. `null` dims everything. Cheap enough to call every frame. */
  show(spot: Spot | null): void;
  hide(): void;
  destroy(): void;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * A full-viewport SVG whose path has a hole. Pointer events hit only the
 * painted part, so clicks inside the hole reach the page underneath.
 */
export function createOverlay(options: OverlayOptions): Overlay {
  const { document: doc, container } = options;
  const view = doc.defaultView!;
  const svg = doc.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'sk-overlay');
  svg.setAttribute('aria-hidden', 'true');

  const mask = doc.createElementNS(SVG_NS, 'path');
  mask.setAttribute('class', 'sk-mask');
  mask.setAttribute('fill-rule', 'evenodd');
  mask.setAttribute('fill', options.color);

  const blocker = doc.createElementNS(SVG_NS, 'rect');
  blocker.setAttribute('class', 'sk-blocker');
  blocker.setAttribute('fill', 'transparent');
  blocker.setAttribute('pointer-events', 'all');

  const ring = doc.createElementNS(SVG_NS, 'rect');
  ring.setAttribute('class', 'sk-ring');

  svg.append(mask, blocker, ring);
  svg.style.display = 'none';
  container.append(svg);

  let current: Rect | null = null;
  let radius = 0;
  let interactive = true;

  const draw = (): void => {
    mask.setAttribute('d', holePath({ width: view.innerWidth, height: view.innerHeight }, current, radius));
    if (current && !interactive) {
      blocker.setAttribute('x', String(current.x));
      blocker.setAttribute('y', String(current.y));
      blocker.setAttribute('width', String(current.width));
      blocker.setAttribute('height', String(current.height));
      blocker.style.display = '';
    } else {
      blocker.style.display = 'none';
    }
    if (current) {
      // The stroke is centered on the edge; grow by half of it so it sits outside the hole.
      ring.setAttribute('x', String(current.x - 1));
      ring.setAttribute('y', String(current.y - 1));
      ring.setAttribute('width', String(current.width + 2));
      ring.setAttribute('height', String(current.height + 2));
      ring.setAttribute('rx', String(radius + 1));
      ring.style.display = '';
    } else {
      ring.style.display = 'none';
    }
  };

  const onBackdropClick = (): void => options.onBackdropClick?.();
  mask.addEventListener('click', onBackdropClick);
  view.addEventListener('resize', draw);

  return {
    show(spot) {
      svg.style.display = '';
      current = spot ? spot.rect : null;
      if (spot) {
        radius = spot.radius;
        interactive = spot.interactive;
      }
      draw();
    },

    hide() {
      current = null;
      svg.style.display = 'none';
    },

    destroy() {
      mask.removeEventListener('click', onBackdropClick);
      view.removeEventListener('resize', draw);
      svg.remove();
    },
  };
}

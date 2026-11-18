import type { TutorialController, TutorialState } from '@tutorial-kit/core';

export interface TutorialLabels {
  prev: string;
  next: string;
  finish: string;
  close: string;
}

export interface MountTutorialOptions {
  /** Where the overlay is appended. Defaults to document.body. */
  root?: HTMLElement;
  labels?: Partial<TutorialLabels>;
  /** Spotlight padding in px around the target. */
  padding?: number;
  /** Base z-index of the overlay. */
  zIndex?: number;
}

const DEFAULT_LABELS: TutorialLabels = {
  prev: 'Back',
  next: 'Next',
  finish: 'Done',
  close: 'Close',
};

// Colors and sizes come from CSS variables, so pages can restyle without forking.
const STYLE = `
.tk-hole,.tk-backdrop,.tk-popover{position:fixed;box-sizing:border-box}
.tk-backdrop{inset:0;background:rgba(0,0,0,.55)}
.tk-hole{border-radius:var(--tk-radius,10px);box-shadow:0 0 0 9999px rgba(0,0,0,.55);transition:all .25s ease;pointer-events:none}
.tk-popover{width:min(340px,calc(100vw - 16px));padding:16px;border-radius:var(--tk-radius,10px);background:var(--tk-bg,#fff);color:var(--tk-fg,#111);font:14px/1.5 system-ui,-apple-system,sans-serif;box-shadow:0 8px 28px rgba(0,0,0,.25)}
.tk-title{margin:0 0 6px;font-size:16px;font-weight:600}
.tk-body{margin:0 0 12px;white-space:pre-line}
.tk-footer{display:flex;align-items:center;gap:8px}
.tk-count{flex:1;color:var(--tk-muted,#666);font-size:12px}
.tk-btn{padding:6px 12px;border:1px solid var(--tk-border,#ccc);border-radius:6px;background:transparent;color:inherit;cursor:pointer;font:inherit}
.tk-btn:disabled{opacity:.4;cursor:default}
.tk-btn-primary{background:var(--tk-accent,#2563eb);border-color:transparent;color:#fff}
.tk-close{position:absolute;top:6px;right:8px;border:0;background:none;color:inherit;font-size:18px;cursor:pointer}
`;

function ensureStyle(zIndex: number): HTMLStyleElement {
  const existing = document.getElementById('tk-style') as HTMLStyleElement | null;
  if (existing) return existing;
  const style = document.createElement('style');
  style.id = 'tk-style';
  style.textContent = STYLE + `.tk-hole,.tk-backdrop,.tk-popover{z-index:${zIndex}}`;
  document.head.appendChild(style);
  return style;
}

/**
 * Mounts a spotlight overlay driven by a tutorial controller.
 * Returns a function that unmounts it and removes its listeners.
 */
export function mountTutorial(controller: TutorialController, options: MountTutorialOptions = {}): () => void {
  const root = options.root ?? document.body;
  const labels: TutorialLabels = { ...DEFAULT_LABELS, ...options.labels };
  const padding = options.padding ?? 8;
  const style = ensureStyle(options.zIndex ?? 10000);

  const backdrop = document.createElement('div');
  backdrop.className = 'tk-backdrop';
  const hole = document.createElement('div');
  hole.className = 'tk-hole';

  const popover = document.createElement('div');
  popover.className = 'tk-popover';
  popover.setAttribute('role', 'dialog');
  popover.setAttribute('aria-modal', 'true');

  const closeBtn = document.createElement('button');
  closeBtn.className = 'tk-close';
  closeBtn.type = 'button';
  closeBtn.textContent = '×';
  closeBtn.setAttribute('aria-label', labels.close);

  const title = document.createElement('h3');
  title.className = 'tk-title';
  const body = document.createElement('p');
  body.className = 'tk-body';

  const footer = document.createElement('div');
  footer.className = 'tk-footer';
  const count = document.createElement('span');
  count.className = 'tk-count';
  const prevBtn = document.createElement('button');
  prevBtn.className = 'tk-btn';
  prevBtn.type = 'button';
  prevBtn.textContent = labels.prev;
  const nextBtn = document.createElement('button');
  nextBtn.className = 'tk-btn tk-btn-primary';
  nextBtn.type = 'button';

  footer.append(count, prevBtn, nextBtn);
  popover.append(closeBtn, title, body, footer);
  root.append(backdrop, hole, popover);

  let state: TutorialState = controller.getState();

  function place(): void {
    const target = state.step?.target ? document.querySelector<HTMLElement>(state.step.target) : null;
    if (!target) {
      hole.style.display = 'none';
      backdrop.style.display = 'block';
      popover.style.top = '50%';
      popover.style.left = '50%';
      popover.style.transform = 'translate(-50%, -50%)';
      return;
    }

    backdrop.style.display = 'none';
    hole.style.display = 'block';
    const rect = target.getBoundingClientRect();
    Object.assign(hole.style, {
      top: `${rect.top - padding}px`,
      left: `${rect.left - padding}px`,
      width: `${rect.width + padding * 2}px`,
      height: `${rect.height + padding * 2}px`,
    });

    // Prefer below the target. Fall back to above, then clamp into the viewport.
    const gap = 12;
    const h = popover.offsetHeight;
    const w = popover.offsetWidth;
    const below = rect.bottom + padding + gap;
    const above = rect.top - padding - gap - h;
    const top = below + h <= window.innerHeight || above < 8 ? below : above;
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - w - 8);
    popover.style.transform = 'none';
    popover.style.top = `${Math.max(8, top)}px`;
    popover.style.left = `${Math.max(8, left)}px`;
  }

  function render(next: TutorialState): void {
    state = next;
    const step = state.step;
    const visible = state.status === 'running' && step !== null;
    for (const el of [backdrop, hole, popover]) el.style.visibility = visible ? 'visible' : 'hidden';
    if (!step) return;

    title.textContent = step.title;
    body.textContent = step.body ?? '';
    body.style.display = step.body ? 'block' : 'none';
    count.textContent = `${state.index + 1} / ${state.total}`;
    prevBtn.disabled = state.isFirst;
    nextBtn.textContent = state.isLast ? labels.finish : labels.next;
    place();
  }

  const unsubscribe = controller.subscribe(render);

  const onNext = () => controller.next();
  const onPrev = () => controller.prev();
  const onClose = () => controller.stop();
  const onKey = (e: KeyboardEvent) => {
    if (state.status !== 'running') return;
    if (e.key === 'Escape') controller.stop();
    else if (e.key === 'ArrowRight') controller.next();
    else if (e.key === 'ArrowLeft') controller.prev();
  };
  const onLayout = () => place();

  nextBtn.addEventListener('click', onNext);
  prevBtn.addEventListener('click', onPrev);
  closeBtn.addEventListener('click', onClose);
  window.addEventListener('keydown', onKey);
  window.addEventListener('resize', onLayout);
  window.addEventListener('scroll', onLayout, true);

  render(state);

  return () => {
    unsubscribe();
    nextBtn.removeEventListener('click', onNext);
    prevBtn.removeEventListener('click', onPrev);
    closeBtn.removeEventListener('click', onClose);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', onLayout);
    window.removeEventListener('scroll', onLayout, true);
    backdrop.remove();
    hole.remove();
    popover.remove();
    if (!document.querySelector('.tk-popover')) style.remove();
  };
}

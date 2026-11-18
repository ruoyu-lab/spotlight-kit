import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type ReactPortal,
} from 'react';
import { createPortal } from 'react-dom';
import type { Step, Tour, TourState } from '@spotlight-kit/core';
import {
  CLOSE_ICON_PATH,
  PROGRESS_DOTS_MAX,
  ROOT_ATTRIBUTE,
  bindKeyboard,
  createOverlay,
  createStage,
  en,
  ensureStyles,
  type Labels,
  type Stage,
  type StageLayout,
} from '@spotlight-kit/dom';
import { useTour } from './use-tour.js';

export interface SpotlightRenderProps {
  state: TourState;
  step: Step;
  labels: Labels;
  next(): boolean;
  prev(): boolean;
  skip(): boolean;
  stop(): void;
}

export interface SpotlightTourProps {
  /** Must stay the same for the component's lifetime; use `key` to swap it. */
  tour: Tour;
  /** Space between the target and the edge of the highlight, in px. Default 8. */
  padding?: number;
  radius?: number;
  gap?: number;
  overlayColor?: string;
  /** Glide duration between steps in ms. 0 disables it. Default 260. */
  animationMs?: number;
  scroll?: 'auto' | 'smooth' | false;
  labels?: Partial<Labels>;
  /** Arrow keys and Escape. Default true. */
  keyboard?: boolean;
  closeOnEscape?: boolean;
  closeOnOverlayClick?: boolean;
  zIndex?: number;
  /** Replaces the popover's content (not its positioning). */
  children?: (props: SpotlightRenderProps) => ReactNode;
}

const HIDDEN: StageLayout = { visible: false, x: 0, y: 0, side: 'center', arrow: 0 };
const useIsomorphicLayoutEffect = typeof document === 'undefined' ? useEffect : useLayoutEffect;

function Progress({ state, labels }: { state: TourState; labels: Labels }) {
  if (state.total <= 1) return null;
  const text = labels.progress(state.index + 1, state.total);
  if (state.total > PROGRESS_DOTS_MAX) return <>{text}</>;
  return (
    <>
      {Array.from({ length: state.total }, (_, i) => (
        <i key={i} className="sk-dot" data-s={i < state.index ? 'done' : i === state.index ? 'current' : 'todo'} aria-hidden="true" />
      ))}
      <span className="sk-sr">{text}</span>
    </>
  );
}

function DefaultContent({ state, step, labels, next, prev, stop, ids }: SpotlightRenderProps & { ids: [string, string] }) {
  return (
    <>
      <button className="sk-close" type="button" aria-label={labels.close} onClick={stop}>
        <svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true">
          <path d={CLOSE_ICON_PATH} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
      {step.title ? (
        <h3 className="sk-title" id={ids[0]}>
          {step.title}
        </h3>
      ) : null}
      {step.body ? (
        <p className="sk-body" id={ids[1]}>
          {step.body}
        </p>
      ) : null}
      <div className="sk-footer">
        <span className="sk-progress">
          <Progress state={state} labels={labels} />
        </span>
        {state.isFirst ? null : (
          <button className="sk-btn" type="button" onClick={prev}>
            {labels.prev}
          </button>
        )}
        <button className="sk-btn sk-btn-primary" type="button" disabled={!state.canNext} onClick={next}>
          {state.isLast ? labels.finish : labels.next}
        </button>
      </div>
    </>
  );
}

/**
 * Draws a tour: dimmed overlay with a hole, plus a popover rendered by React
 * through a portal. Mount it once, anywhere:
 *
 *   <SpotlightTour tour={tour} />
 *
 * Pass a function as children to replace the popover's content:
 *
 *   <SpotlightTour tour={tour}>{({ step, next }) => <button onClick={next}>{step.title}</button>}</SpotlightTour>
 *
 * Options other than `labels` are read when the component mounts.
 */
export function SpotlightTour(props: SpotlightTourProps): ReactPortal | null {
  const { tour, children } = props;
  const { state, next, prev, skip, stop } = useTour(tour);
  const uid = useId();

  const latest = useRef(props);
  latest.current = props;

  const [host, setHost] = useState<HTMLElement | null>(null);
  const [layout, setLayout] = useState<StageLayout>(HIDDEN);
  const popoverRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Stage | null>(null);

  useEffect(() => {
    const options = latest.current;
    const doc = document;
    ensureStyles(doc);

    const root = doc.createElement('div');
    root.className = 'sk-root';
    root.setAttribute(ROOT_ATTRIBUTE, '');
    root.hidden = true;
    if (options.zIndex !== undefined) root.style.setProperty('--sk-z', String(options.zIndex));
    doc.body.append(root);

    const overlay = createOverlay({
      document: doc,
      container: root,
      color: options.overlayColor ?? 'rgba(15, 23, 42, 0.6)',
      onBackdropClick: options.closeOnOverlayClick ? () => tour.stop() : undefined,
    });
    const stage = createStage({
      document: doc,
      overlay,
      padding: options.padding ?? 8,
      radius: options.radius ?? 8,
      gap: options.gap ?? 12,
      scroll: options.scroll ?? 'smooth',
      animationMs: options.animationMs ?? 260,
      measurePopover: () => {
        const el = popoverRef.current;
        if (!el) return null;
        const { width, height } = el.getBoundingClientRect();
        return { width, height };
      },
      onLayout: setLayout,
    });
    const stopKeyboard =
      options.keyboard === false ? null : bindKeyboard(tour, { document: doc, closeOnEscape: options.closeOnEscape });

    stageRef.current = stage;
    setHost(root);
    return () => {
      stopKeyboard?.();
      stage.destroy();
      root.remove();
      stageRef.current = null;
      setHost(null);
    };
  }, [tour]);

  const active = state.status === 'running' && state.phase === 'active' && state.step !== null;

  // After React committed the popover, so it can be measured before the browser paints.
  useIsomorphicLayoutEffect(() => {
    if (!host) return;
    host.hidden = !active;
    stageRef.current?.update(state);
  }, [state, host, active]);

  if (!host || !active || !state.step) return null;

  const labels: Labels = { ...en, ...props.labels };
  const ids: [string, string] = [`${uid}-title`, `${uid}-body`];
  const renderProps: SpotlightRenderProps = { state, step: state.step, labels, next, prev, skip, stop };
  const style = {
    visibility: layout.visible ? 'visible' : 'hidden',
    transform: `translate(${Math.round(layout.x)}px, ${Math.round(layout.y)}px)`,
    '--sk-arrow': `${Math.round(layout.arrow)}px`,
  } as CSSProperties;

  return createPortal(
    <div
      ref={popoverRef}
      className="sk-popover sk-in"
      role="dialog"
      aria-labelledby={ids[0]}
      aria-describedby={ids[1]}
      tabIndex={-1}
      data-side={layout.side}
      style={style}
    >
      <div className="sk-arrow" />
      {children ? children(renderProps) : <DefaultContent {...renderProps} ids={ids} />}
    </div>,
    host,
  );
}

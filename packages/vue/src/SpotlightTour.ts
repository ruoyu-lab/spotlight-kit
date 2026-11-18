import {
  Teleport,
  computed,
  defineComponent,
  h,
  onBeforeUnmount,
  onMounted,
  shallowRef,
  watch,
  type PropType,
  type VNode,
} from 'vue';
import type { Step, Tour, TourState } from '@spotlight-kit/core';
import {
  CLOSE_ICON_PATH,
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

export interface SpotlightSlotProps {
  state: TourState;
  step: Step;
  labels: Labels;
  next(): boolean;
  prev(): boolean;
  skip(): boolean;
  stop(): void;
}

const HIDDEN: StageLayout = { visible: false, x: 0, y: 0, side: 'center', arrow: 0 };
let counter = 0;

/**
 * Draws a tour: dimmed overlay with a hole, plus a popover rendered by Vue.
 * Mount it once, anywhere (it teleports to `<body>`):
 *
 *   <SpotlightTour :tour="tour" />
 *
 * The default slot replaces the popover's content (not its positioning):
 *
 *   <SpotlightTour :tour="tour" v-slot="{ step, next, labels }">...</SpotlightTour>
 *
 * Props are read once when the component mounts. The `tour` must stay the
 * same for the component's lifetime; use `:key` to swap it.
 */
export const SpotlightTour = defineComponent({
  name: 'SpotlightTour',
  props: {
    tour: { type: Object as PropType<Tour>, required: true },
    padding: { type: Number, default: 8 },
    radius: { type: Number, default: 8 },
    gap: { type: Number, default: 12 },
    overlayColor: { type: String, default: 'rgba(15, 23, 42, 0.6)' },
    animationMs: { type: Number, default: 260 },
    scroll: { type: [String, Boolean] as PropType<'auto' | 'smooth' | false>, default: 'smooth' },
    labels: { type: Object as PropType<Partial<Labels>>, default: undefined },
    keyboard: { type: Boolean, default: true },
    closeOnEscape: { type: Boolean, default: true },
    closeOnOverlayClick: { type: Boolean, default: false },
    zIndex: { type: Number, default: undefined },
  },
  setup(props, { slots }) {
    const { state, next, prev, skip, stop } = useTour(props.tour);
    const labels = computed<Labels>(() => ({ ...en, ...props.labels }));
    const uid = `sk-vue-${++counter}`;

    const host = shallowRef<HTMLElement | null>(null);
    const popoverEl = shallowRef<HTMLElement | null>(null);
    const layout = shallowRef<StageLayout>(HIDDEN);

    let stage: Stage | null = null;
    let stopKeyboard: (() => void) | null = null;
    let stopWatchers: Array<() => void> = [];

    onMounted(() => {
      const doc = document;
      ensureStyles(doc);

      const root = doc.createElement('div');
      root.className = 'sk-root';
      root.setAttribute(ROOT_ATTRIBUTE, '');
      root.hidden = true;
      if (props.zIndex !== undefined) root.style.setProperty('--sk-z', String(props.zIndex));
      doc.body.append(root);

      const overlay = createOverlay({
        document: doc,
        container: root,
        color: props.overlayColor,
        onBackdropClick: props.closeOnOverlayClick ? stop : undefined,
      });

      stage = createStage({
        document: doc,
        overlay,
        padding: props.padding,
        radius: props.radius,
        gap: props.gap,
        scroll: props.scroll,
        animationMs: props.animationMs,
        measurePopover: () => {
          const el = popoverEl.value;
          if (!el) return null;
          const { width, height } = el.getBoundingClientRect();
          return { width, height };
        },
        onLayout: (next) => {
          layout.value = next;
        },
      });

      if (props.keyboard) stopKeyboard = bindKeyboard(props.tour, { document: doc, closeOnEscape: props.closeOnEscape });

      host.value = root;
      stopWatchers = [
        // After Vue has patched the popover, so it can be measured.
        watch(
          state,
          (s) => {
            root.hidden = !(s.status === 'running' && s.phase === 'active');
            stage?.update(s);
          },
          { flush: 'post', immediate: true },
        ),
        // The popover appears one tick after the state does when the tour was already running.
        watch(popoverEl, () => stage?.relayout(), { flush: 'post' }),
      ];
    });

    onBeforeUnmount(() => {
      stopWatchers.forEach((stopWatcher) => stopWatcher());
      stopKeyboard?.();
      stage?.destroy();
      host.value?.remove();
      stage = null;
      host.value = null;
    });

    const defaultContent = (s: TourState, step: Step): VNode[] => {
      const l = labels.value;
      return [
        h('button', { class: 'sk-close', type: 'button', 'aria-label': l.close, onClick: stop }, [
          h('svg', { viewBox: '0 0 14 14', width: 14, height: 14, 'aria-hidden': 'true' }, [
            h('path', { d: CLOSE_ICON_PATH, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.6, 'stroke-linecap': 'round' }),
          ]),
        ]),
        step.title ? h('h3', { class: 'sk-title', id: `${uid}-title` }, step.title) : null,
        step.body ? h('p', { class: 'sk-body', id: `${uid}-body` }, step.body) : null,
        h('div', { class: 'sk-footer' }, [
          h('span', { class: 'sk-progress' }, s.total > 1 ? l.progress(s.index + 1, s.total) : ''),
          s.isFirst ? null : h('button', { class: 'sk-btn', type: 'button', onClick: prev }, l.prev),
          h(
            'button',
            { class: 'sk-btn sk-btn-primary', type: 'button', disabled: !s.canNext, onClick: next },
            s.isLast ? l.finish : l.next,
          ),
        ]),
      ].filter((node): node is VNode => node !== null);
    };

    return () => {
      const s = state.value;
      const root = host.value;
      if (!root || s.status !== 'running' || s.phase !== 'active' || !s.step) return null;

      const l = layout.value;
      const content = slots.default
        ? slots.default({ state: s, step: s.step, labels: labels.value, next, prev, skip, stop } satisfies SpotlightSlotProps)
        : defaultContent(s, s.step);

      return h(Teleport, { to: root }, [
        h(
          'div',
          {
            ref: popoverEl,
            class: 'sk-popover',
            role: 'dialog',
            'aria-labelledby': `${uid}-title`,
            'aria-describedby': `${uid}-body`,
            tabindex: -1,
            'data-side': l.side,
            style: {
              visibility: l.visible ? 'visible' : 'hidden',
              transform: `translate(${Math.round(l.x)}px, ${Math.round(l.y)}px)`,
              '--sk-arrow': `${Math.round(l.arrow)}px`,
            },
          },
          [h('div', { class: 'sk-arrow' }), ...content],
        ),
      ]);
    };
  },
});

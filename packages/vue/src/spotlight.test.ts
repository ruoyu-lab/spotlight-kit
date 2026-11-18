// @vitest-environment happy-dom
import { createApp, h, nextTick } from 'vue';
import { afterEach, describe, expect, it } from 'vitest';
import { SpotlightTour, createDomPlatform, createTour, useTour } from './index.js';

const isVisible = (el: Element) => el.isConnected;

let unmount: (() => void) | null = null;
afterEach(() => {
  unmount?.();
  unmount = null;
  document.body.innerHTML = '';
});

function mount(component: ReturnType<typeof h> | object, props: Record<string, unknown>) {
  const el = document.createElement('div');
  document.body.append(el);
  const app = createApp(component as never, props);
  app.mount(el);
  unmount = () => app.unmount();
}

function makeTour() {
  document.body.insertAdjacentHTML('beforeend', '<button id="go">Go</button>');
  return createTour({
    ...createDomPlatform({ isVisible }),
    id: 'vue',
    steps: [{ id: 'a', title: 'First', body: 'Hello' }, { id: 'b', title: 'Second', target: '#go' }],
  });
}

describe('<SpotlightTour>', () => {
  it('renders the popover for the running tour and follows state', async () => {
    const tour = makeTour();
    mount(SpotlightTour, { tour, animationMs: 0 });
    await nextTick();
    expect(document.querySelector('.sk-popover')).toBeNull();

    tour.start();
    await nextTick();
    await nextTick();
    expect(document.querySelector('.sk-title')!.textContent).toBe('First');
    expect(document.querySelector('.sk-body')!.textContent).toBe('Hello');

    document.querySelector<HTMLButtonElement>('.sk-btn-primary')!.click();
    await nextTick();
    await nextTick();
    expect(tour.getState().index).toBe(1);
    expect(document.querySelector('.sk-title')!.textContent).toBe('Second');
  });

  it('the default slot replaces the content but keeps the popover shell', async () => {
    const tour = makeTour();
    const app = createApp({
      render: () =>
        h(SpotlightTour, { tour, animationMs: 0 }, { default: ({ step, next }: { step: { title?: string }; next(): boolean }) => [h('button', { class: 'mine', onClick: next }, step.title)] }),
    });
    const el = document.createElement('div');
    document.body.append(el);
    app.mount(el);
    unmount = () => app.unmount();

    tour.start();
    await nextTick();
    await nextTick();
    expect(document.querySelector('.sk-popover .mine')!.textContent).toBe('First');
    expect(document.querySelector('.sk-title')).toBeNull();
    document.querySelector<HTMLButtonElement>('.mine')!.click();
    expect(tour.getState().index).toBe(1);
  });

  it('removes its DOM and listeners on unmount', async () => {
    const tour = makeTour();
    mount(SpotlightTour, { tour, animationMs: 0 });
    tour.start();
    await nextTick();
    unmount!();
    unmount = null;
    expect(document.querySelector('[data-spotlight-kit-root]')).toBeNull();
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(tour.getState().index).toBe(0);
  });
});

describe('useTour', () => {
  it('exposes reactive state', async () => {
    const tour = makeTour();
    let api!: ReturnType<typeof useTour>;
    mount({ setup: () => ((api = useTour(tour)), () => null) }, {});
    expect(api.state.value.status).toBe('idle');
    api.start();
    expect(api.state.value).toMatchObject({ status: 'running', index: 0 });
    api.next();
    expect(api.state.value.index).toBe(1);
  });
});

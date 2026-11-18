// @vitest-environment happy-dom
import { act, useEffect, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SpotlightTour, createDomPlatform, createTour, useTour, type UseTour } from './index';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const isVisible = (el: Element) => el.isConnected;

let root: Root | null = null;
beforeEach(() => {
  document.body.innerHTML = '';
});
afterEach(() => {
  act(() => root?.unmount());
  root = null;
});

function render(element: ReactElement): void {
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root!.render(element));
}

function makeTour() {
  document.body.insertAdjacentHTML('beforeend', '<button id="go">Go</button>');
  return createTour({
    ...createDomPlatform({ isVisible }),
    id: 'react',
    steps: [{ id: 'a', title: 'First', body: 'Hello' }, { id: 'b', title: 'Second', target: '#go' }],
  });
}

describe('<SpotlightTour>', () => {
  it('renders the popover for the running tour and follows state', () => {
    const tour = makeTour();
    render(<SpotlightTour tour={tour} animationMs={0} />);
    expect(document.querySelector('.sk-popover')).toBeNull();

    act(() => tour.start());
    expect(document.querySelector('.sk-title')!.textContent).toBe('First');
    expect(document.querySelector('.sk-body')!.textContent).toBe('Hello');
    expect(document.querySelector('.sk-popover')!.getAttribute('role')).toBe('dialog');
    expect(document.querySelector('.sk-close svg path')).not.toBeNull();

    act(() => document.querySelector<HTMLButtonElement>('.sk-btn-primary')!.click());
    expect(tour.getState().index).toBe(1);
    expect(document.querySelector('.sk-title')!.textContent).toBe('Second');
    expect(document.querySelector('.sk-mask')!.getAttribute('d')!.split('M').length).toBeGreaterThan(2);
  });

  it('children replace the content but keep the popover shell', () => {
    const tour = makeTour();
    render(
      <SpotlightTour tour={tour} animationMs={0}>
        {({ step, next }) => (
          <button className="mine" onClick={next}>
            {step.title}
          </button>
        )}
      </SpotlightTour>,
    );
    act(() => tour.start());
    expect(document.querySelector('.sk-popover .mine')!.textContent).toBe('First');
    expect(document.querySelector('.sk-title')).toBeNull();
    act(() => document.querySelector<HTMLButtonElement>('.mine')!.click());
    expect(tour.getState().index).toBe(1);
  });

  it('cleans up DOM and listeners on unmount', () => {
    const tour = makeTour();
    render(<SpotlightTour tour={tour} animationMs={0} />);
    act(() => tour.start());
    act(() => root!.unmount());
    root = null;
    expect(document.querySelector('[data-spotlight-kit-root]')).toBeNull();
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(tour.getState().index).toBe(0);
  });
});

describe('useTour', () => {
  it('re-renders on tour changes and exposes actions', () => {
    const tour = makeTour();
    let api!: UseTour;
    const seen: number[] = [];
    function Probe() {
      api = useTour(tour);
      useEffect(() => void seen.push(api.state.index));
      return null;
    }
    render(<Probe />);
    expect(api.state.status).toBe('idle');
    act(() => api.start());
    expect(api.state).toMatchObject({ status: 'running', index: 0 });
    act(() => void api.next());
    expect(api.state.index).toBe(1);
    expect(seen).toContain(1);
  });
});

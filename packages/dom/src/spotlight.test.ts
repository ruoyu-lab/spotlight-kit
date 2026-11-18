// @vitest-environment happy-dom
import { createTour } from '@spotlight-kit/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  appears,
  attr,
  click,
  createDomPlatform,
  createSpotlight,
  disappears,
  hasClass,
  input,
  zhCN,
} from './index.js';

// happy-dom has no layout, so visibility is simply "attached".
const isVisible = (el: Element) => el.isConnected;
const settle = () => new Promise((resolve) => setTimeout(resolve, 5));

function html(markup: string): void {
  document.body.innerHTML = markup;
}

let tours: Array<{ destroy(): void }> = [];
function track<T extends { destroy(): void }>(tour: T): T {
  tours.push(tour);
  return tour;
}

beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
});
afterEach(() => {
  tours.forEach((t) => t.destroy());
  tours = [];
});

function makeTour(steps: Parameters<typeof createTour>[0]['steps']) {
  return track(createTour({ ...createDomPlatform({ isVisible }), id: 'dom', steps }));
}

describe('environment', () => {
  it('waits for a selector target that is inserted later', async () => {
    html('<div id="host"></div>');
    const tour = makeTour([{ id: 'a', target: '#late' }]);
    tour.start();
    expect(tour.getState().phase).toBe('locating');

    const el = document.createElement('button');
    el.id = 'late';
    document.getElementById('host')!.append(el);
    await settle();
    expect(tour.getState()).toMatchObject({ phase: 'active', target: el });
  });

  it('follows the target when the app re-renders it', async () => {
    html('<div id="host"><button id="t">one</button></div>');
    const tour = makeTour([{ id: 'a', target: '#t' }]);
    tour.start();
    document.getElementById('host')!.innerHTML = '<button id="t">two</button>';
    await settle();
    expect(tour.getState().target).toBe(document.getElementById('t'));
    expect((tour.getState().target as Element).textContent).toBe('two');
  });

  it('accepts elements and getter functions as targets', () => {
    html('<p id="p"></p><p id="q"></p>');
    const p = document.getElementById('p')!;
    const tour = makeTour([{ id: 'a', target: p }, { id: 'b', target: () => document.getElementById('q') }]);
    tour.start();
    expect(tour.getState().target).toBe(p);
    tour.next();
    expect(tour.getState().target).toBe(document.getElementById('q'));
  });

  it('treats elements the visibility check rejects as not present', () => {
    html('<p id="p"></p>');
    const tour = track(
      createTour({
        ...createDomPlatform({ isVisible: () => false }),
        id: 'hidden',
        waitTimeout: Infinity,
        steps: [{ id: 'a', target: '#p' }],
      }),
    );
    tour.start();
    expect(tour.getState().phase).toBe('locating');
  });
});

describe('completion detectors', () => {
  it('click on the target (or inside it) completes the step', async () => {
    html('<button id="b"><span id="inner">go</span></button><button id="other">x</button>');
    const tour = makeTour([{ id: 'a', target: '#b', completion: click() }, { id: 'b' }]);
    tour.start();

    document.getElementById('other')!.click();
    await settle();
    expect(tour.getState().index).toBe(0);

    document.getElementById('inner')!.click();
    expect(tour.getState().index).toBe(0); // deferred until the page's own handlers ran
    await settle();
    expect(tour.getState().index).toBe(1);
  });

  it('click can name its own target', async () => {
    html('<div id="t"></div><button id="go"></button>');
    const tour = makeTour([{ id: 'a', target: '#t', completion: click('#go') }, { id: 'b' }]);
    tour.start();
    document.getElementById('go')!.click();
    await settle();
    expect(tour.getState().index).toBe(1);
  });

  it('input waits for a matching value', async () => {
    html('<input id="i" />');
    const field = document.getElementById('i') as HTMLInputElement;
    const tour = makeTour([{ id: 'a', target: '#i', completion: input(undefined, /^\d{3}$/) }, { id: 'b' }]);
    tour.start();

    field.value = '12';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
    expect(tour.getState().index).toBe(0);

    field.value = '123';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
    expect(tour.getState().index).toBe(1);
  });

  it('appears completes when another element shows up', async () => {
    html('<button id="open"></button><div id="host"></div>');
    const tour = makeTour([{ id: 'a', target: '#open', completion: appears('#dialog') }, { id: 'b' }]);
    tour.start();
    document.getElementById('host')!.innerHTML = '<div id="dialog"></div>';
    await settle();
    expect(tour.getState().index).toBe(1);
  });

  it('disappears completes when the element goes away', async () => {
    html('<div id="dialog"></div><button id="t"></button>');
    const tour = makeTour([{ id: 'a', target: '#t', completion: disappears('#dialog') }, { id: 'b' }]);
    tour.start();
    expect(tour.getState().index).toBe(0);
    document.getElementById('dialog')!.remove();
    await settle();
    expect(tour.getState().index).toBe(1);
  });

  it('attr and hasClass watch element state', async () => {
    html('<div id="t" aria-expanded="false"></div>');
    const t = document.getElementById('t')!;
    const tour = makeTour([
      { id: 'a', target: '#t', completion: attr(undefined, 'aria-expanded', 'true') },
      { id: 'b', target: '#t', completion: hasClass(undefined, 'done') },
      { id: 'c' },
    ]);
    tour.start();
    t.setAttribute('aria-expanded', 'true');
    await settle();
    expect(tour.getState().index).toBe(1);
    t.classList.add('done');
    await settle();
    expect(tour.getState().index).toBe(2);
  });

  it('a step without any target cannot use a target-less DOM completion', () => {
    const tour = makeTour([{ id: 'a', completion: click() }]);
    tour.on('error', () => {});
    tour.start();
    expect(tour.getState().status).toBe('idle');
  });

  it('stops listening once the step is left', async () => {
    html('<button id="b"></button>');
    const tour = makeTour([{ id: 'a', target: '#b', completion: click() }, { id: 'b', target: '#b' }, { id: 'c' }]);
    tour.start();
    tour.skip();
    document.getElementById('b')!.click();
    await settle();
    expect(tour.getState().index).toBe(1);
  });
});

describe('createSpotlight', () => {
  const steps = [
    { id: 'one', title: 'Welcome', body: '<b>not html</b>' },
    { id: 'two', title: 'Search', target: '#search', placement: 'bottom' as const },
  ];

  function start(extra = {}) {
    html('<input id="search" />');
    return track(createSpotlight({ id: 'demo', steps, environment: { isVisible } }, { animationMs: 0, ...extra }));
  }

  it('renders nothing until started, then shows title and escaped body', () => {
    const tour = start();
    const root = document.querySelector<HTMLElement>('[data-spotlight-kit-root]')!;
    expect(root.hidden).toBe(true);

    tour.start();
    expect(root.hidden).toBe(false);
    expect(root.querySelector('.sk-title')!.textContent).toBe('Welcome');
    expect(root.querySelector('.sk-body')!.textContent).toBe('<b>not html</b>');
    expect(root.querySelector('.sk-body b')).toBeNull();
    expect(root.querySelector('.sk-popover')!.getAttribute('role')).toBe('dialog');
  });

  it('buttons drive the tour and the last step offers "Done"', () => {
    const tour = start({ labels: zhCN });
    tour.start();
    const next = () => document.querySelector<HTMLButtonElement>('.sk-btn-primary')!;
    expect(next().textContent).toBe('下一步');
    next().click();
    expect(tour.getState().index).toBe(1);
    expect(next().textContent).toBe('完成');
    expect(document.querySelector('.sk-progress')!.textContent).toBe('2 / 2');
    next().click();
    expect(tour.getState().status).toBe('finished');
    expect(document.querySelector<HTMLElement>('[data-spotlight-kit-root]')!.hidden).toBe(true);
  });

  it('draws a mask path with a hole for a targeted step', () => {
    const tour = start();
    tour.start(1);
    const d = document.querySelector('.sk-mask')!.getAttribute('d')!;
    expect(d.split('M').length).toBeGreaterThan(2); // outer + inner subpath
  });

  it('gates the primary button while the completion is pending', () => {
    html('<input id="search" />');
    const tour = track(
      createSpotlight(
        { id: 'gate', steps: [{ id: 'a', target: '#search', completion: input() }, { id: 'b' }], environment: { isVisible } },
        { animationMs: 0 },
      ),
    );
    tour.start();
    expect(document.querySelector<HTMLButtonElement>('.sk-btn-primary')!.disabled).toBe(true);
  });

  it('keyboard: arrows navigate, Escape closes, typing is left alone', () => {
    const tour = start();
    tour.start();
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(tour.getState().index).toBe(1);
    const field = document.getElementById('search')!;
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(tour.getState().index).toBe(1);
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(tour.getState().status).toBe('idle');
  });

  it('accepts a custom popover factory', () => {
    const tour = start({
      popover: ({ document: doc }: { document: Document }) => {
        const element = doc.createElement('div');
        element.className = 'mine';
        return {
          element,
          update: (s: { step: { title?: string } | null }) => void (element.textContent = s.step?.title ?? ''),
          destroy: () => element.remove(),
        };
      },
    });
    tour.start();
    expect(document.querySelector('.mine')!.textContent).toBe('Welcome');
    expect(document.querySelector('.sk-popover')).toBeNull();
  });

  it('destroy removes all DOM and styles', () => {
    const tour = start();
    tour.start();
    tour.destroy();
    expect(document.querySelector('[data-spotlight-kit-root]')).toBeNull();
    expect(document.getElementById('spotlight-kit-style')).toBeNull();
  });
});

# spotlight-kit

[简体中文](README.zh-CN.md)

Step-by-step product tours that dim the page and spotlight the thing the user should touch next. The engine is plain TypeScript with no DOM and no framework, so the UI is yours to replace. A ready-made DOM renderer and an optional Vue 3 component are included.

- **Headless core.** `@spotlight-kit/core` is a state machine: steps, navigation, waiting for targets, completion detection. It never touches the DOM.
- **Follows the user, not the clock.** A step can finish when the user actually clicks, types, or when an element appears. Targets that render late are waited for.
- **Works on real apps.** Scrolls the target into view, follows it while it moves, survives re-renders.
- **Drop-in or bring your own UI.** Use `createSpotlight()` for the default overlay and popover, `<SpotlightTour>` in Vue, or drive the core from any UI.

> Status: 0.0.1-beta. Install with the `beta` tag: `npm i @spotlight-kit/dom@beta`.

## Packages

| Package | What it is | Depends on |
| --- | --- | --- |
| `@spotlight-kit/core` | Tour engine, completion combinators. No DOM. | nothing |
| `@spotlight-kit/dom` | Target lookup, DOM completion conditions, overlay, popover | core |
| `@spotlight-kit/vue` | `<SpotlightTour>` component and `useTour()` | core, dom, vue (peer) |
| `@spotlight-kit/react` | `<SpotlightTour>` component and `useTour()` hook | core, dom, react (peer) |

## Quick start (plain HTML)

```ts
import { createSpotlight, click, input } from '@spotlight-kit/dom';

const tour = createSpotlight({
  id: 'onboarding',
  steps: [
    { id: 'welcome', title: 'Welcome', body: 'A one minute walkthrough.' },
    {
      id: 'name',
      title: 'Name your project',
      target: '#project-name',
      completion: input(undefined, (value) => value.length >= 3),
    },
    {
      id: 'create',
      title: 'Create it',
      target: '#create',
      completion: click(),
    },
    { id: 'done', title: 'Your project', target: '#project-card' }, // waits until it is rendered
  ],
});

tour.start();
```

Runnable demos: [`examples/basic`](examples/basic/index.html) (plain HTML), [`examples/vue`](examples/vue) (`npm run example:vue`) and [`examples/react`](examples/react) (`npm run example:react`).

## Steps

```ts
interface Step {
  id: string;
  title?: string;
  body?: string;                  // plain text, never interpreted as HTML
  target?: string | Element | (() => Element | null);   // omit for a centered step
  placement?: 'auto' | 'top' | 'bottom' | 'left' | 'right';
  interactive?: boolean;          // can the user operate the highlighted area? default true

  completion?: Completion | (() => boolean | Promise<boolean>) | Completion[];
  advance?: 'auto' | 'manual';    // what to do once completed. default 'auto'
  advanceDelay?: number;          // ms before auto-advancing
  skippable?: boolean;            // allow Next before the completion is met

  waitTimeout?: number;           // ms to wait for the target. default 5000, Infinity = forever
  onMissing?: 'skip' | 'show' | 'stop';   // after the timeout. default 'skip'

  beforeEnter?(ctx): void | Promise<void>;   // e.g. open a menu, change route
  afterLeave?(ctx): void;
  data?: Record<string, unknown>;
}
```

### Completion conditions

| Builder | Completes when |
| --- | --- |
| `click(target?)`, `change()`, `submit()`, `event(name, target?)` | the event happens on the target |
| `input(target?, match?)` | the user typed and the value satisfies `match` (RegExp, string, or function). IME drafts (pinyin, kana) are ignored until the composition is committed |
| `appears(target?)` / `disappears(target?)` | the element shows up / is gone |
| `attr(target, name, value?)`, `hasClass(target, name)`, `elementState(target, fn)` | the element reaches that state |
| `when(fn)` or a bare function | `fn()` returns (or resolves to) true. Polled. Use it for route, API or store state |
| `any(...)`, `all(...)`, array shorthand | combinations |
| `delay(ms)` | time passed |

`target` defaults to the step's target. Conditions re-resolve targets on every check, so they survive re-renders. While a completion is pending, `next()` is refused unless the step is `skippable` (`tour.skip()` always works).

## Use the core with your own UI

```ts
import { createTour } from '@spotlight-kit/core';
import { createDomPlatform } from '@spotlight-kit/dom'; // only for DOM lookups and conditions

const tour = createTour({ ...createDomPlatform(), id: 'tour', steps });

tour.subscribe((state) => {
  // state.step, state.index, state.total, state.phase, state.target (the element),
  // state.canNext, state.canPrev, state.completed ...
  render(state);
});
tour.on('finish', () => localStorage.setItem('tour-done', '1'));
```

`state` is an immutable snapshot, replaced on every change. Wiring it to React, Svelte or anything else is a few lines. For the geometry (hole path, popover placement, following the target) reuse `createStage()` from `@spotlight-kit/dom`.

## Vue 3

```vue
<script setup lang="ts">
import { SpotlightTour, useTour, createTour, createDomPlatform } from '@spotlight-kit/vue';

const tour = createTour({ ...createDomPlatform(), id: 'home', steps: [/* ... */] });
const { state, start } = useTour(tour);
</script>

<template>
  <button @click="start()">Take the tour</button>
  <SpotlightTour :tour="tour" />
</template>
```

The default slot replaces the popover's content and keeps its positioning:

```vue
<SpotlightTour :tour="tour" v-slot="{ step, state, next, prev, stop, labels }">
  <h3>{{ step.title }}</h3>
  <button :disabled="!state.canNext" @click="next">{{ labels.next }}</button>
</SpotlightTour>
```

## React

```tsx
import { SpotlightTour, useTour, createTour, createDomPlatform } from '@spotlight-kit/react';

const tour = createTour({ ...createDomPlatform(), id: 'home', steps: [/* ... */] });

export function App() {
  const { state, start } = useTour(tour); // useSyncExternalStore under the hood
  return (
    <>
      <button onClick={() => start()}>Take the tour</button>
      <SpotlightTour tour={tour} />
    </>
  );
}
```

Pass a function as children to replace the popover's content and keep its positioning: `<SpotlightTour tour={tour}>{({ step, next, labels }) => ...}</SpotlightTour>`.

## Persistence and routes

The core keeps no storage on purpose. Save progress yourself and resume with `tour.start(index)`:

```ts
tour.on('step', ({ index }) => localStorage.setItem('tour:step', String(index)));
tour.on('finish', () => localStorage.setItem('tour:step', 'done'));
```

For route changes use `beforeEnter` (`router.push(...)`), then let the step wait for its target.

## Styling and i18n

The default look is driven by CSS variables: `--sk-accent`, `--sk-bg`, `--sk-fg`, `--sk-text`, `--sk-radius`, `--sk-z`, and more (see `packages/dom/src/styles.ts`). Set them anywhere above the overlay, such as `:root`:

```css
:root {
  --sk-accent: #e11d48;
  --sk-radius: 6px;
}
```

Whatever you leave unset keeps its default, which follows `prefers-color-scheme`; motion follows `prefers-reduced-motion`. Button texts come from `labels`; `en` and `zhCN` are built in.

## Development

```bash
npm install
npm run build      # all packages
npm test           # vitest (core + dom + vue)
npm run typecheck
```

Design notes: [docs/architecture.md](docs/architecture.md).

## License

[MIT](LICENSE)

# tutorial-kit

A step-by-step, spotlight-style tutorial engine for the web.

- **Core is pure logic.** `@tutorial-kit/core` is a state machine with no DOM, no UI and no framework. Use it with any renderer.
- **Plain HTML works out of the box.** `@tutorial-kit/dom` mounts a spotlight overlay with no framework and no build step.
- **Vue 3 is optional.** `@tutorial-kit/vue` only binds the core to Vue reactivity, and you can skip it entirely.
- **Backend-agnostic.** Tutorials are plain JSON-shaped objects, so they can come from a static file, an API or code.

中文说明见 [README.zh-CN.md](README.zh-CN.md).

## Packages

| Package | Purpose | Depends on |
| --- | --- | --- |
| `@tutorial-kit/core` | Steps, navigation, state, persistence hook | nothing |
| `@tutorial-kit/dom` | Spotlight overlay and popover for plain HTML | core |
| `@tutorial-kit/vue` | `useTutorial()` composable for Vue 3 | core, vue |

## Quick start (no bundler)

```bash
npm install
npm run build
```

Open `examples/basic/index.html` through a local static server, for example `npx serve .`.

## Usage

```ts
import { createTutorial } from '@tutorial-kit/core';
import { mountTutorial } from '@tutorial-kit/dom';

const tutorial = createTutorial({
  tutorial: {
    id: 'onboarding',
    steps: [
      { id: 'welcome', title: 'Welcome', body: 'A quick tour.' },
      { id: 'search', title: 'Search', body: 'Type here.', target: '#search' },
    ],
  },
  storage: window.localStorage, // optional: resume where the user left off
});

const unmount = mountTutorial(tutorial);
tutorial.start();
```

Vue 3:

```ts
import { useTutorial } from '@tutorial-kit/vue';
const { state, next, prev, stop } = useTutorial(tutorial);
```

Build your own UI on the core by calling `subscribe` and rendering `getState()`.

## Development

```bash
npm install
npm test          # vitest
npm run typecheck
npm run build
```

## License

[MIT](LICENSE)

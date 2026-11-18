# spotlight-kit

[English](README.md)

分步骤的产品新手引导:遮住页面,只高亮用户下一步该操作的区域。引擎是不依赖 DOM 和任何框架的纯 TypeScript,界面可以完全替换;同时提供开箱即用的 DOM 渲染层和可选的 Vue 3 组件。

- **无界面核心**:`@spotlight-kit/core` 是状态机,负责步骤、导航、等待目标、完成检测,从不碰 DOM。
- **跟着用户走**:一步何时算完成,由用户真实的点击、输入或元素出现来决定,而不是定时器。目标元素晚渲染也会等待。
- **适配真实应用**:自动滚动到目标、目标移动时跟随、框架重新渲染后仍然有效。
- **开箱即用,也能自带界面**:`createSpotlight()` 带默认遮罩和气泡,Vue 里用 `<SpotlightTour>`,也可以只用核心驱动任意 UI。

> 状态:0.1.0,尚未发布到 npm。发布前请从源码构建(见[开发](#开发))。

## 包

| 包 | 作用 | 依赖 |
| --- | --- | --- |
| `@spotlight-kit/core` | 引导引擎、完成条件组合子,无 DOM | 无 |
| `@spotlight-kit/dom` | 目标查找、DOM 完成条件、遮罩、气泡 | core |
| `@spotlight-kit/vue` | `<SpotlightTour>` 组件和 `useTour()` | core、dom、vue(peer) |

## 快速开始(原生 HTML)

```ts
import { createSpotlight, click, input } from '@spotlight-kit/dom';

const tour = createSpotlight({
  id: 'onboarding',
  steps: [
    { id: 'welcome', title: '欢迎', body: '一分钟了解基本操作。' },
    {
      id: 'name',
      title: '给项目起名',
      target: '#project-name',
      completion: input(undefined, (value) => value.length >= 3),
    },
    {
      id: 'create',
      title: '创建',
      target: '#create',
      completion: click(),
    },
    { id: 'done', title: '你的项目', target: '#project-card' }, // 渲染出来之前会一直等待
  ],
});

tour.start();
```

可运行的页面见 [`examples/basic`](examples/basic/index.html)。

## 步骤

```ts
interface Step {
  id: string;
  title?: string;
  body?: string;                  // 纯文本,不会被当作 HTML
  target?: string | Element | (() => Element | null);   // 省略则居中显示
  placement?: 'auto' | 'top' | 'bottom' | 'left' | 'right';
  interactive?: boolean;          // 用户能否操作高亮区域,默认 true

  completion?: Completion | (() => boolean | Promise<boolean>) | Completion[];
  advance?: 'auto' | 'manual';    // 完成后的行为,默认 'auto'
  advanceDelay?: number;          // 自动前进前的等待毫秒数
  skippable?: boolean;            // 条件未满足时也允许点“下一步”

  waitTimeout?: number;           // 等待目标出现的毫秒数,默认 5000,Infinity 为一直等
  onMissing?: 'skip' | 'show' | 'stop';   // 超时后的处理,默认 'skip'

  beforeEnter?(ctx): void | Promise<void>;   // 例如打开菜单、切换路由
  afterLeave?(ctx): void;
  data?: Record<string, unknown>;
}
```

### 完成条件

| 构造函数 | 何时完成 |
| --- | --- |
| `click(target?)`、`change()`、`submit()`、`event(name, target?)` | 目标上发生了该事件 |
| `input(target?, match?)` | 用户输入后,值满足 `match`(正则、字符串或函数) |
| `appears(target?)` / `disappears(target?)` | 元素出现 / 消失 |
| `attr(target, name, value?)`、`hasClass(target, name)`、`elementState(target, fn)` | 元素达到某种状态 |
| `when(fn)` 或直接写函数 | `fn()` 返回(或 resolve)为 true,会轮询。适合路由、接口、状态库 |
| `any(...)`、`all(...)`、数组简写 | 组合 |
| `delay(ms)` | 经过一段时间 |

`target` 省略时使用该步骤自己的目标。条件每次检查都会重新解析目标,所以框架重新渲染后依然有效。完成条件未满足时 `next()` 会被拒绝,除非步骤设置了 `skippable`(`tour.skip()` 始终可用)。

## 只用核心,自带界面

```ts
import { createTour } from '@spotlight-kit/core';
import { createDomPlatform } from '@spotlight-kit/dom'; // 仅用于 DOM 查找和完成条件

const tour = createTour({ ...createDomPlatform(), id: 'tour', steps });

tour.subscribe((state) => {
  // state.step、state.index、state.total、state.phase、state.target(元素本身)、
  // state.canNext、state.canPrev、state.completed ...
  render(state);
});
tour.on('finish', () => localStorage.setItem('tour-done', '1'));
```

`state` 是不可变快照,每次变化都会换成新对象,接入 React、Svelte 等只需几行。几何计算(镂空路径、气泡定位、跟随目标)可直接复用 `@spotlight-kit/dom` 的 `createStage()`。

## Vue 3

```vue
<script setup lang="ts">
import { SpotlightTour, useTour, createTour, createDomPlatform } from '@spotlight-kit/vue';

const tour = createTour({ ...createDomPlatform(), id: 'home', steps: [/* ... */] });
const { state, start } = useTour(tour);
</script>

<template>
  <button @click="start()">开始引导</button>
  <SpotlightTour :tour="tour" />
</template>
```

默认插槽替换气泡内容,保留定位:

```vue
<SpotlightTour :tour="tour" v-slot="{ step, state, next, prev, stop, labels }">
  <h3>{{ step.title }}</h3>
  <button :disabled="!state.canNext" @click="next">{{ labels.next }}</button>
</SpotlightTour>
```

## 进度保存与路由

核心刻意不内置存储。自己保存进度,再用 `tour.start(index)` 续上:

```ts
tour.on('step', ({ index }) => localStorage.setItem('tour:step', String(index)));
tour.on('finish', () => localStorage.setItem('tour:step', 'done'));
```

路由切换用 `beforeEnter`(`router.push(...)`),然后让步骤等待自己的目标出现。

## 样式与多语言

默认外观由 CSS 变量控制:`--sk-accent`、`--sk-bg`、`--sk-fg`、`--sk-radius`、`--sk-z` 等(见 `packages/dom/src/styles.ts`),并跟随 `prefers-color-scheme` 与 `prefers-reduced-motion`。按钮文案来自 `labels`,内置 `en` 和 `zhCN`。

## 开发

```bash
npm install
npm run build      # 构建全部包
npm test           # vitest(core + dom + vue)
npm run typecheck
```

设计说明:[docs/architecture.md](docs/architecture.md)。

## 许可证

[MIT](LICENSE)

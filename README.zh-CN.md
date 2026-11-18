# tutorial-kit

面向网页的「分步骤 + 聚焦高亮」教程引擎。

- **核心只有逻辑**：`@tutorial-kit/core` 是纯状态机，不依赖 DOM、UI 或任何框架，可接任意渲染层。
- **原生 HTML 开箱即用**：`@tutorial-kit/dom` 用纯 DOM 渲染聚焦遮罩和气泡，不需要框架，也不需要构建。
- **Vue 3 只是可选扩展**：`@tutorial-kit/vue` 只把核心状态接入 Vue 响应式，不用可以不装。
- **与后端无关**：教程就是普通对象（JSON 形状），可以来自静态文件、接口或代码。

## 包说明

| 包 | 作用 | 依赖 |
| --- | --- | --- |
| `@tutorial-kit/core` | 步骤、导航、状态、进度持久化接口 | 无 |
| `@tutorial-kit/dom` | 原生 HTML 的聚焦遮罩与气泡 | core |
| `@tutorial-kit/vue` | Vue 3 的 `useTutorial()` 组合式函数 | core、vue |

## 快速开始（无需打包）

```bash
npm install
npm run build
```

用本地静态服务器打开 `examples/basic/index.html`，例如 `npx serve .`。

## 用法

```ts
import { createTutorial } from '@tutorial-kit/core';
import { mountTutorial } from '@tutorial-kit/dom';

const tutorial = createTutorial({
  tutorial: {
    id: 'onboarding',
    steps: [
      { id: 'welcome', title: '欢迎', body: '快速浏览一下。' },
      { id: 'search', title: '搜索', body: '在这里输入。', target: '#search' },
    ],
  },
  storage: window.localStorage, // 可选：下次从上次的位置继续
});

const unmount = mountTutorial(tutorial);
tutorial.start();
```

## 许可证

[MIT](LICENSE)

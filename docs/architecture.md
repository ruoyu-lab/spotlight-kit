# 架构说明

目标:引导逻辑与界面彻底解耦。核心不依赖 DOM 和任何框架,界面层(原生 DOM、Vue,或用户自己写的)只消费核心产出的状态。

## 分层

```
┌────────────────────────────────────────────────┐
│ @spotlight-kit/vue | react  <SpotlightTour>,   │  可选
│                              useTour           │
├────────────────────────────────────────────────┤
│ @spotlight-kit/dom                              │
│   environment  目标查找与监听 (MutationObserver) │
│   detectors    DOM 完成条件 (event/appear/...)   │
│   stage        滚动、跟随目标、遮罩、气泡定位     │  渲染器无关
│   renderer     默认气泡 + 键盘 + 焦点            │
├────────────────────────────────────────────────┤
│ @spotlight-kit/core   (无 DOM,无框架)           │
│   createTour   状态机                            │
│   completion   predicate / any / all / delay    │
└────────────────────────────────────────────────┘
```

依赖只向下:`vue / react → dom → core`,框架包之间互不依赖。`core` 的 `tsconfig` 不含 DOM 库,所以误用 DOM API 会直接编译失败。

## core:状态机

`createTour(options)` 返回 `Tour`。核心对外部世界一无所知,只通过两个注入点交互:

- **`TargetEnvironment`**:`locate(ref)` 同步查找、`watch(ref, cb)` 监听变化。核心拿到的目标是不透明的 `handle`,不关心它是什么。不传时 `ref` 本身就是 `handle`。
- **`Detector`**:完成条件的实现,按 `Completion.type` 注册。核心内置 `predicate`、`any`、`all`、`delay`,DOM 相关的由 `dom` 包提供。

### 一个步骤的生命周期

```
enter(i) ─▶ preparing ─▶ locating ─▶ active ─▶ (completed) ─▶ leave
            beforeEnter   等目标出现   显示气泡    条件满足
```

- `preparing`:执行 `beforeEnter`(可异步),用于打开菜单、切换路由。
- `locating`:有 `target` 时等它出现;超过 `waitTimeout` 后按 `onMissing` 处理(`skip` 跳过、`show` 居中显示、`stop` 报错结束)。
- `active`:目标就绪,启动完成条件检测。目标被重新渲染或消失时,`state.target` 会随之更新,步骤保持 active。
- 条件满足后 `completed = true`,`advance: 'auto'` 时进入下一步。

### 防过期机制

每次离开步骤都会递增 `session`。所有异步回调(`beforeEnter` 的 promise、watch 回调、定时器、检测器的 `complete`)都带着创建时的 token,与当前 `session` 不一致就直接丢弃。因此快速点击上一步/下一步、条件在步骤切换后才满足等竞态都不会产生脏状态。清理函数收集在 `teardown` 中,离开步骤时逆序执行。

### 状态与事件

- `getState()` / `subscribe()` 提供不可变快照,每次变化换新对象,适合直接放进 `shallowRef`、`useSyncExternalStore` 之类。
- `on('start' | 'step' | 'complete' | 'finish' | 'stop' | 'error')` 提供一次性事件,用于埋点和进度保存。
- 监听器抛错被隔离,不会破坏引擎。

### `canNext` 规则

`running && phase === 'active' && (无 completion || 已完成 || skippable)`。`skip()` 绕过该规则。

## dom

### 目标监听

`createDomEnvironment` 解析选择器、元素、函数三种引用,并只把"已连接、有布局、非 `visibility:hidden`"的元素视为存在(可通过 `isVisible` 覆盖)。`watch` 用一个文档级 `MutationObserver` 加窗口 `resize` 重新求值,变化时回调。自身渲染的节点带 `data-spotlight-kit-root`,其变化会被忽略,避免自我触发。

### 完成条件

事件类条件在 `document` 上用捕获阶段监听,每次事件都重新解析目标并用 `composedPath()` 判断归属。这样元素被框架替换、事件发生在 shadow DOM 内部都不会漏。完成动作用 `setTimeout(0)` 延后,让页面自己的处理函数先执行,下一步看到的是操作之后的页面。

**输入法**:`input` 与 `elementState` 会忽略 `isComposing` 为真的输入事件(拼音、假名等草稿阶段输入框里已有字母,值并不是最终内容),并在 `compositionend` 之后重新判断。

### Stage:渲染器无关的几何层

`createStage` 接收 `TourState`,完成:滚动到可见 → 每帧跟随目标矩形(`requestAnimationFrame` 比较,覆盖 transform 动画、兄弟元素位移、任意祖先滚动)→ 驱动遮罩 → 计算气泡位置并回调 `onLayout`。它不创建气泡,所以默认 DOM 气泡、Vue 气泡和 React 气泡共用同一套逻辑。

**步骤间的滑动动画**由 stage 统一计算:遮罩的镂空矩形和气泡位置都由同一个缓动进度插值得到,所以两者不会错位;目标在滑动途中继续移动(平滑滚动)时,终点会实时跟随。`prefers-reduced-motion` 下自动关闭。

纯函数集中在 `geometry.ts`(镂空路径、气泡避让与翻转、箭头偏移),在 Node 下即可单测。

### 遮罩

一个全屏 SVG,`path` 用 `evenodd` 挖洞。SVG 只有被绘制的部分响应指针,所以洞内的点击直接落到页面上,用户可以真实操作目标。`interactive: false` 时在洞上盖一个透明矩形拦截操作。

### 替换点

- `popover` 选项:提供自己的 `PopoverView` 工厂即可替换气泡的全部 DOM;渲染器只负责定位。
- 只想要逻辑:`createTour({ ...createDomPlatform(), ... })`,自己渲染。
- 想要几何但不要气泡:用 `createStage` + `createOverlay`。

## vue / react

只做绑定,不含引导逻辑,两者结构对称:

- `useTour(tour)`:Vue 把快照放进 `shallowRef` 并随作用域销毁取消订阅;React 用 `useSyncExternalStore`。
- `<SpotlightTour>`:复用 `createStage`/`createOverlay`,气泡由框架渲染并传送到根节点(Vue 用 `Teleport`,React 用 portal),默认插槽 / children 函数替换内容。组件不销毁 `tour`,它的生命周期属于使用者。React 下已在 StrictMode 中验证副作用可重复执行。

## 有意不做(v1)

- **进度持久化**与**跨路由流程**:核心不内置存储或路由集成,留出 `on('step')`、`start(index)`、`beforeEnter` 三个钩子,README 有示例。
- **iframe 内目标**:当前只处理同一文档。
- **焦点陷阱**:弹层会把焦点移入对话框(无完成条件的步骤),但不强制困住 Tab,因为引导期间用户常需要操作页面。

## 构建

三个包各自 `tsc` 输出 ESM 与 `.d.ts`。源码内相对导入带 `.js` 后缀,产物可被 Node、浏览器原生 ESM(import map)与打包器直接使用。测试通过 vitest 别名直接跑源码,无需先构建。

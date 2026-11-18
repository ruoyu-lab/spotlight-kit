import { useState } from 'react';
import { SpotlightTour, click, createDomPlatform, createTour, input, useTour, zhCN } from '@spotlight-kit/react';

// A tour is plain data plus the DOM platform. It lives outside any component.
const tour = createTour({
  ...createDomPlatform(),
  id: 'react-demo',
  steps: [
    { id: 'welcome', title: '欢迎', body: '这是 React 版本的示例。' },
    {
      id: 'name',
      title: '起个名字',
      body: '输入至少 3 个字符,完成后自动进入下一步。支持中文输入法。',
      target: '#name',
      completion: input(undefined, (v) => v.trim().length >= 3),
    },
    {
      id: 'create',
      title: '创建项目',
      body: '点击按钮。结果由 React 异步渲染,导览会等它出现。',
      target: '#create',
      completion: click(),
    },
    { id: 'result', title: '创建成功', target: '#result', placement: 'top' },
    { id: 'export', title: '导出', body: '页面下方的按钮,会自动滚动过去。', target: '#export', interactive: false },
  ],
});

export function App() {
  const { state, start } = useTour(tour);
  const [name, setName] = useState('');
  const [created, setCreated] = useState(false);

  return (
    <>
      <header>
        <strong>Acme (React)</strong>
        <button onClick={() => start()}>产品导览</button>
      </header>

      <main>
        <div className="card">
          <label htmlFor="name">项目名称</label>
          <br />
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="至少输入 3 个字符" autoComplete="off" />
        </div>

        <div className="card">
          <button id="create" className="primary" onClick={() => setTimeout(() => setCreated(true), 800)}>
            创建项目
          </button>
          {created ? <p id="result">✅ 项目 {name} 已创建</p> : null}
        </div>

        <div className="spacer">向下滚动 ↓</div>

        <div className="card">
          <button id="export">导出报告</button>
        </div>

        <pre className="card">
          useTour().state → {JSON.stringify({ status: state.status, step: state.step?.id ?? null, phase: state.phase, canNext: state.canNext })}
        </pre>
      </main>

      <SpotlightTour tour={tour} labels={zhCN} />
    </>
  );
}

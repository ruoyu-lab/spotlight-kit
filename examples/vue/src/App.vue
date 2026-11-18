<script setup lang="ts">
import { ref } from 'vue';
import { SpotlightTour, createDomPlatform, createTour, click, input, useTour, zhCN } from '@spotlight-kit/vue';

const name = ref('');
const created = ref(false);

// A tour is plain data plus the DOM platform. It lives outside any component.
const tour = createTour({
  ...createDomPlatform(),
  id: 'vue-demo',
  steps: [
    { id: 'welcome', title: '欢迎', body: '这是 Vue 3 版本的示例。' },
    {
      id: 'name',
      title: '起个名字',
      body: '输入至少 3 个字符,完成后自动进入下一步。',
      target: '#name',
      completion: input(undefined, (v) => v.trim().length >= 3),
    },
    {
      id: 'create',
      title: '创建项目',
      body: '点击按钮。结果由 Vue 异步渲染,导览会等它出现。',
      target: '#create',
      completion: click(),
    },
    { id: 'result', title: '创建成功', target: '#result', placement: 'top' },
    { id: 'export', title: '导出', body: '页面下方的按钮,会自动滚动过去。', target: '#export', interactive: false },
  ],
});

const { state, start } = useTour(tour);

function create() {
  setTimeout(() => (created.value = true), 800);
}
</script>

<template>
  <header>
    <strong>Acme (Vue)</strong>
    <button @click="start()">产品导览</button>
  </header>

  <main>
    <div class="card">
      <label for="name">项目名称</label><br />
      <input id="name" v-model="name" placeholder="至少输入 3 个字符" autocomplete="off" />
    </div>

    <div class="card">
      <button id="create" class="primary" @click="create">创建项目</button>
      <p v-if="created" id="result">✅ 项目 {{ name }} 已创建</p>
    </div>

    <div class="spacer">向下滚动 ↓</div>

    <div class="card"><button id="export">导出报告</button></div>

    <pre class="card">useTour().state → {{ { status: state.status, step: state.step?.id ?? null, phase: state.phase, canNext: state.canNext } }}</pre>
  </main>

  <!-- 默认外观;想换内容就用默认插槽: <SpotlightTour v-slot="{ step, next }">...</SpotlightTour> -->
  <SpotlightTour :tour="tour" :labels="zhCN" />
</template>

<style>
body { margin: 0; font: 16px/1.6 system-ui, -apple-system, "PingFang SC", sans-serif; color: #111827; background: #f9fafb; }
header { display: flex; align-items: center; justify-content: space-between; padding: 12px 24px; background: #fff; }
main { max-width: 680px; margin: 24px auto; padding: 0 16px; }
.card { background: #fff; border-radius: 10px; padding: 16px; margin: 16px 0; }
.spacer { height: 70vh; display: grid; place-items: center; color: #9ca3af; }
input { font: inherit; padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 6px; width: 60%; }
button { font: inherit; padding: 8px 14px; border: 0; border-radius: 6px; background: #e5e7eb; cursor: pointer; }
button.primary { background: #2563eb; color: #fff; }
pre { font-size: 13px; white-space: pre-wrap; }
</style>

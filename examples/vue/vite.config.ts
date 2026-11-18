import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const src = (pkg: string) => fileURLToPath(new URL(`../../packages/${pkg}/src/index.ts`, import.meta.url));

export default defineConfig({
  plugins: [vue()],
  // Run against the sources: edit a package and the example reloads, no build needed.
  resolve: {
    alias: {
      '@spotlight-kit/core': src('core'),
      '@spotlight-kit/dom': src('dom'),
      '@spotlight-kit/vue': src('vue'),
    },
  },
});

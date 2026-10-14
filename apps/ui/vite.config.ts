import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
const source = (path: string) => fileURLToPath(new URL(path, import.meta.url));
export default defineConfig({
  resolve: {
    alias: {
      '@mu-survivor/game': source('../../packages/game/src'),
      '@mu-survivor/models': source('../../packages/models/src'),
      '@mu-survivor/sdk': source('../../packages/sdk/src'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: process.env.DEV_API_URL || 'http://127.0.0.1:5174' },
      '/healthz': { target: process.env.DEV_API_URL || 'http://127.0.0.1:5174' },
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    emptyOutDir: true,
    rolldownOptions: {
      output: { codeSplitting: { groups: [{ name: 'three', test: /node_modules[\\/]three/ }] } },
    },
  },
});

import { defineConfig } from 'vite';

export default defineConfig({
  // 相对路径产物，便于直接把 dist/ 部署到 Qoder Sites 等静态托管。
  base: './',
  server: {
    port: 5173,
    open: false
  },
  build: {
    outDir: 'dist',
    assetsDir: 'static',
    target: 'es2022'
  }
});

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // base: './' 确保资源（js/css）使用相对路径加载
  // 这对于 GitHub Pages 这种非根目录部署 (/repo-name/) 至关重要
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
  }
})
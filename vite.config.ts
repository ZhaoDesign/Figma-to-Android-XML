
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // 使用 './' 确保在任何子路径下部署都能正确找到资源
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
    // 确保生成的 index.html 引用的是正确的相对路径
    rollupOptions: {
      input: './index.html'
    }
  },
  server: {
    port: 3000,
    open: true
  }
})

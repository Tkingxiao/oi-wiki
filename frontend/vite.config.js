import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:6660',
        changeOrigin: true,
        ws: true,  // 支持 WebSocket（如果需要）
        // 不重写路径，直接转发 /api/xxx 到后端
      },
      '/login': {
        target: 'http://localhost:6660',
        changeOrigin: true
      },
      '/register': {
        target: 'http://localhost:6660',
        changeOrigin: true
      },
      '/sendVerification': {
        target: 'http://localhost:6660',
        changeOrigin: true
      },
      '/verifyCode': {
        target: 'http://localhost:6660',
        changeOrigin: true
      },
      '/bilibili': {
        target: 'http://localhost:6660',
        changeOrigin: true
      },
      '/uploads': {
        target: 'http://localhost:6660',
        changeOrigin: true
      }
    }
  }
})
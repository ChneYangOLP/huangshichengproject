import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
  ],
  server: {
    proxy: { '/api': 'http://127.0.0.1:18080' },
  },
  preview: {
    proxy: { '/api': 'http://127.0.0.1:18080' },
  },
})

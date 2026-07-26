import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' để chạy được ở mọi đường dẫn con của GitHub Pages
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: 'dist', sourcemap: false }
})

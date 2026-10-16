import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Served from GitHub Pages at iammix.github.io/mixi-os/.
  base: '/mixi-os/',
  plugins: [react()],
})

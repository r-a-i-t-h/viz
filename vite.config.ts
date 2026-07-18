import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const root = path.dirname(fileURLToPath(import.meta.url))

// Multi-page: demo host + independently hostable visualizer (+ embed shell).
// Relative base so viz.html (+ assets) can be served from any subdirectory.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    fs: {
      allow: [root],
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(root, 'index.html'),
        visualizer: path.resolve(root, 'viz.html'),
        embed: path.resolve(root, 'embed.html'),
      },
    },
  },
})

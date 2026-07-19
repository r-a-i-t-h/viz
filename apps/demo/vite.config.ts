import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const root = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(root, '../..')

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    fs: {
      allow: [repoRoot],
    },
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(root, 'index.html'),
        embed: path.resolve(root, 'embed.html'),
      },
    },
  },
})

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const root = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(root, '../..')

// Relative base so the built page (+ assets) can be served from any subdirectory.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: true,
    fs: {
      allow: [repoRoot],
    },
  },
  preview: {
    port: 4174,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})

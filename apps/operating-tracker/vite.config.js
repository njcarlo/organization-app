import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@hae/firebase': path.resolve(__dirname, '../../packages/firebase/src/index.js'),
      '@hae/branding': path.resolve(__dirname, '../../packages/branding/src'),
      '@hae/ui': path.resolve(__dirname, '../../packages/ui/src/index.js'),
    },
  },
  server: {
    fs: {
      allow: [path.resolve(__dirname, '../..')],
    },
  },
})

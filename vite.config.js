import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const previewBuild = {
  name: 'isolated-test-preview',
  transformIndexHtml: {
    order: 'pre',
    handler(html) {
      return html.replace('    <script type="module" src="/config.js"></script>\n', '')
    },
  },
}

export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react(), ...(mode === 'test-preview' ? [previewBuild] : [])],
  publicDir: mode === 'test-preview' ? false : 'public',
  build: {
    sourcemap: mode !== 'test-preview',
  },
}))

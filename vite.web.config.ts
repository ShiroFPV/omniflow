import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Standalone browser build - no Electron. See src/platform/webApi.ts for the
// browser-native implementation of the same window.api bridge Electron's
// preload script provides, so src/App.tsx and everything under src/pages and
// src/components is shared, unmodified, between both builds.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174,
    open: '/index.web.html',
  },
  build: {
    outDir: 'dist-web',
    rollupOptions: {
      input: 'index.web.html',
    },
  },
})

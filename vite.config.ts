/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// GitHub Pages serves the app from /FlipTurn/; the iOS app loads it from its
// own bundle with relative paths; local dev serves it from /.
export default defineConfig(({ mode }) => ({
  base: mode === 'ios' ? './' : process.env.GITHUB_PAGES ? '/FlipTurn/' : '/',
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'node',
  },
}))

/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// GitHub Pages serves the app from /FlipTurn/; local dev serves it from /.
export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/FlipTurn/' : '/',
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'node',
  },
})

import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // For GitHub Pages: set VITE_BASE at build time, e.g. "/flexible-itinerary/".
  // In CI we set it from the repo name automatically.
  const env = loadEnv(mode, '.', '')

  return {
    base: env.VITE_BASE ?? '/',
    plugins: [react()],
    server: {
      host: true,
    },
  }
})

import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const mealieBaseUrl = env.VITE_MEALIE_BASE_URL ?? 'http://localhost:9000'

  return {
    server: {
      port: 3000,
      proxy: {
        // Proxy all /api requests to the Mealie backend during development.
        // This means Mealie's OAuth redirect URI (constructed relative to the
        // request host) will resolve back to this dev server — no separate
        // reverse proxy needed for the OAuth flow to work.
        '/api': {
          target: mealieBaseUrl,
          changeOrigin: true,
        },
      },
    },
    resolve: {
      tsconfigPaths: true,
    },
    plugins: [
      tanstackStart({
        spa: {
          enabled: true,
        },
      }),
      // react's vite plugin must come after start's vite plugin
      viteReact(),
    ],
  }
})

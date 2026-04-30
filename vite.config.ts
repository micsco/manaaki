import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // MEALIE_INTERNAL_URL is the canonical var name (matches nginx runtime env).
  // Fall back to the old VITE_MEALIE_BASE_URL for backwards compatibility with
  // existing .env files.
  const mealieBaseUrl =
    env.MEALIE_INTERNAL_URL ?? env.VITE_MEALIE_BASE_URL ?? 'http://localhost:9000'

  // The API token is only used by the Vite dev proxy to inject the Authorization
  // header — it is never embedded in the built JS bundle.
  const mealieToken = env.MEALIE_API_TOKEN ?? ''

  return {
    server: {
      port: Number(process.env.PORT) || 3000,
      proxy: {
        // Proxy all /api requests to the Mealie backend during development.
        // The configure hook injects the Authorization header so that local dev
        // behaves identically to production (where nginx injects it).
        '/api': {
          target: mealieBaseUrl,
          changeOrigin: true,
          configure: (proxy) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            proxy.on('proxyReq', (proxyReq: any) => {
              if (mealieToken) {
                proxyReq.setHeader('Authorization', `Bearer ${mealieToken}`)
              }
            })
          },
        },
      },
    },
    resolve: {
      tsconfigPaths: true,
    },
    plugins: [
      tanstackStart({
        prerender: {
          enabled: false,
        },
        spa: {
          enabled: true,
        },
      }),
      // react's vite plugin must come after start's vite plugin
      viteReact(),
    ],
  }
})

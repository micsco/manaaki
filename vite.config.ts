import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import svgr from 'vite-plugin-svgr'

function emitVersionJson(sha: string): Plugin {
  return {
    name: 'emit-version-json',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ sha }),
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  const mealieBaseUrl =
    env.MEALIE_INTERNAL_URL ?? env.VITE_MEALIE_BASE_URL ?? 'http://localhost:9000'
  const mealieToken = env.MEALIE_API_TOKEN ?? ''
  const buildSha = env.VITE_BUILD_GIT_SHORT_SHA ?? 'dev'

  return {
    server: {
      port: Number(process.env.PORT) || 3000,
      proxy: {
        '/api': {
          target: mealieBaseUrl,
          changeOrigin: true,
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq: any) => {
              if (mealieToken) {
                proxyReq.setHeader('Authorization', `Bearer ${mealieToken}`)
              }
            })
          },
        },
        '/ingest/static': {
          target: 'https://eu-assets.i.posthog.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/ingest/, ''),
        },
        '/ingest/array': {
          target: 'https://eu-assets.i.posthog.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/ingest/, ''),
        },
        '/ingest': {
          target: 'https://eu.i.posthog.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/ingest/, ''),
        },
      },
    },
    resolve: {
      tsconfigPaths: true,
    },

    build: {
      sourcemap: true,
    },

    plugins: [
      emitVersionJson(buildSha),
      svgr(),
      tanstackStart(),
      // viteReact must come after tanstackStart
      viteReact(),
    ],
  }
})

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

  // Make server-only vars available to BFF server routes during `vite dev`.
  for (const key of ['MEALIE_INTERNAL_URL', 'MEALIE_READONLY_TOKEN', 'SESSION_SECRET']) {
    if (env[key]) process.env[key] = env[key]
  }

  const buildSha = env.VITE_BUILD_GIT_SHORT_SHA ?? 'dev'

  return {
    server: {
      port: Number(process.env.PORT) || 3000,
      proxy: {
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

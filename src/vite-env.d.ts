/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

interface ImportMetaEnv {
  // Required at build time — Vite refuses to start without these.
  readonly VITE_PUBLIC_POSTHOG_PROJECT_TOKEN: string
  readonly VITE_PUBLIC_POSTHOG_HOST: string
  // Set in the Dockerfile build step from git + the docker build clock.
  // Undefined in dev (vite dev never sets them), so render conditionally.
  readonly VITE_BUILD_GIT_SHA?: string
  readonly VITE_BUILD_GIT_SHORT_SHA?: string
  readonly VITE_BUILD_TIME?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

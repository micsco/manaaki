import { currentBuildSha } from "../pwa/appUpdate"

export async function loadAnalytics() {
  const { default: posthog } = await import("posthog-js")
  const appVersion = currentBuildSha()
  posthog.init(import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN, {
    api_host: "/ingest",
    ui_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
    defaults: "2025-05-24",
    capture_exceptions: true,
    capture_pageview: false,
    tracing_headers: [window.location.hostname],
    debug: import.meta.env.DEV,
    metrics: {
      serviceName: "manaaki-web",
      serviceVersion: appVersion ?? undefined,
      environment: import.meta.env.MODE,
    },
  })
  if (appVersion) posthog.register({ app_version: appVersion })
  return posthog
}

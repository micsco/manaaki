export async function loadAnalytics() {
  const { default: posthog } = await import("posthog-js")
  posthog.init(import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN, {
    api_host: "/ingest",
    ui_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
    defaults: "2025-05-24",
    capture_exceptions: true,
    capture_pageview: false,
    debug: import.meta.env.DEV,
  })
  return posthog
}

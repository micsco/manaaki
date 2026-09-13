import { useIsFetching } from "@tanstack/react-query"
import { useRouter } from "@tanstack/react-router"
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react"

import { createBufferedAnalytics } from "../lib/analytics"
import { loadAnalytics } from "../lib/loadAnalytics"

const AnalyticsContext = createContext(createBufferedAnalytics(false))

export const usePostHog = () => useContext(AnalyticsContext)

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const [analytics] = useState(() =>
    createBufferedAnalytics(Boolean(import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN))
  )
  const fetching = useIsFetching()
  const started = useRef(false)

  useEffect(() => {
    if (fetching || started.current || !import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN) return
    let idle: number | undefined
    let cancelled = false
    const start = () => {
      if (cancelled) return
      started.current = true
      void loadAnalytics()
        .then(client => analytics.connect(client))
        .catch(() => {
          started.current = false
        })
    }
    const timer = window.setTimeout(() => {
      if (window.requestIdleCallback) idle = window.requestIdleCallback(start, { timeout: 2000 })
      else start()
    }, 1000)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      if (idle !== undefined) window.cancelIdleCallback(idle)
    }
  }, [analytics, fetching])

  return <AnalyticsContext.Provider value={analytics}>{children}</AnalyticsContext.Provider>
}

export function AnalyticsPageViews() {
  const router = useRouter()
  const analytics = usePostHog()
  useEffect(() => {
    let previousUrl = ""
    const capture = () => {
      if (previousUrl === window.location.href) return
      previousUrl = window.location.href
      analytics.capture("$pageview")
    }
    capture()
    return router.subscribe("onResolved", capture)
  }, [analytics, router])
  return null
}

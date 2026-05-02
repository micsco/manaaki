import { PostHogProvider } from "@posthog/react"
import { type QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createRootRouteWithContext, HeadContent, Outlet, Scripts } from "@tanstack/react-router"
import { NuqsAdapter } from "nuqs/adapters/tanstack-router"
import type { ReactNode } from "react"
import { CookModeProvider } from "../contexts/CookModeContext"
import { queryClient } from "../lib/queryClient"
import "../styles/globals.css"

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "What's Cookin'" },
    ],
    links: [
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Playfair+Display:wght@700;800&display=swap",
      },
    ],
  }),
  component: RootComponent,
  notFoundComponent: NotFound,
})

function RootComponent() {
  return (
    <RootDocument>
      <PostHogProvider
        apiKey={import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN}
        options={{
          api_host: "/ingest",
          ui_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
          defaults: "2025-05-24",
          capture_exceptions: true,
          debug: import.meta.env.DEV,
        }}
      >
        <QueryClientProvider client={queryClient}>
          <NuqsAdapter>
            <CookModeProvider>
              <Outlet />
            </CookModeProvider>
          </NuqsAdapter>
        </QueryClientProvider>
      </PostHogProvider>
    </RootDocument>
  )
}

function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950">
      <div className="text-center">
        <h1 className="mb-4 font-bold text-4xl text-gray-100">404</h1>
        <p className="text-gray-400 text-lg">Page not found.</p>
      </div>
    </div>
  )
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <div className="root">{children}</div>
        <Scripts />
      </body>
    </html>
  )
}

import { createFileRoute } from "@tanstack/react-router"
import { handleApiProxy } from "../server/proxy"

export const Route = createFileRoute("/api/$")({
  server: {
    handlers: {
      GET: ({ request }) => handleApiProxy(request),
      POST: ({ request }) => handleApiProxy(request),
      PUT: ({ request }) => handleApiProxy(request),
      PATCH: ({ request }) => handleApiProxy(request),
      DELETE: ({ request }) => handleApiProxy(request),
    },
  },
})

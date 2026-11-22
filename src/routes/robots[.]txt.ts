import { createFileRoute } from "@tanstack/react-router"

import { handleRobotsTxt } from "../server/discovery"

export const Route = createFileRoute("/robots.txt")({
  server: { handlers: { GET: ({ request }) => handleRobotsTxt(request) } },
})

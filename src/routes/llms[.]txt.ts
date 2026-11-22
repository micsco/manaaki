import { createFileRoute } from "@tanstack/react-router"

import { handleLlmsTxt } from "../server/discovery"

export const Route = createFileRoute("/llms.txt")({
  server: { handlers: { GET: ({ request }) => handleLlmsTxt(request) } },
})

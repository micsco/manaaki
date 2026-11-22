import { createFileRoute } from "@tanstack/react-router"

import { handleSitemapXml } from "../server/discovery"

export const Route = createFileRoute("/sitemap.xml")({
  server: { handlers: { GET: ({ request }) => handleSitemapXml(request) } },
})

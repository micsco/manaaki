import { createFileRoute } from "@tanstack/react-router"

import { recipeVersionDraftHandler } from "../server/recipeVersionDraftHandler"

export const Route = createFileRoute("/api/manaaki/recipe-versions/draft")({
  server: { handlers: { POST: ({ request }) => recipeVersionDraftHandler(request) } },
})

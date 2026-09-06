import type { QueryClient } from "@tanstack/react-query"

import { decodeRecipeId } from "../utils/recipe"

export function warmVisiblePage(client: Pick<QueryClient, "refetchQueries">) {
  void client.refetchQueries({ type: "active" }, { cancelRefetch: false })
  const match = /^\/recipes\/([^/]+)\/[^/]+$/.exec(window.location.pathname)
  if (!match) return
  try {
    const id = decodeRecipeId(match[1])
    void fetch(`/api/recipes/${encodeURIComponent(id)}`).catch(() => {})
  } catch {}
}

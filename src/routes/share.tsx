import { createFileRoute, useLocation, useNavigate } from "@tanstack/react-router"

import { ImportRecipeModal } from "../components/ImportRecipeModal"
import { sharedRecipeUrl, validateShareSearch } from "../utils/sharedRecipe"

export const Route = createFileRoute("/share")({
  validateSearch: validateShareSearch,
  head: () => ({
    meta: [{ title: "Import shared recipe · Manaaki" }, { name: "robots", content: "noindex" }],
  }),
  component: SharedRecipePage,
})

function SharedRecipePage() {
  const search = Route.useSearch()
  const href = useLocation({ select: location => location.href })
  const navigate = useNavigate()
  return (
    <ImportRecipeModal
      key={href}
      open
      shared
      initialUrl={sharedRecipeUrl(search)}
      returnTo={href}
      onOpenChange={open => {
        if (!open) void navigate({ to: "/recipes", replace: true })
      }}
    />
  )
}

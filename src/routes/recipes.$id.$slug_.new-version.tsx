import { createFileRoute, Link } from "@tanstack/react-router"

import { configureApiClient } from "../api/client"
import { getOneApiRecipesSlugGet } from "../api/generated/sdk.gen"
import type { RecipeOutput } from "../api/generated/types.gen"
import { RecipeVersionPage } from "../components/RecipeVersionPage"
import { useCurrentUser } from "../hooks/useCurrentUser"
import { decodeRecipeId } from "../utils/recipe"

async function loader({ params }: { params: { id: string; slug: string } }): Promise<RecipeOutput> {
  configureApiClient()
  const result = await getOneApiRecipesSlugGet({
    path: { slug: decodeRecipeId(params.id) },
    cache: "reload",
  })
  if (!result.data) throw new Error("Recipe not found")
  return result.data
}

export const Route = createFileRoute("/recipes/$id/$slug_/new-version")({
  head: ({ loaderData }) => ({
    meta: [
      { title: `New version of ${loaderData?.name ?? "recipe"} · Manaaki` },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader,
  component: NewVersionRoute,
})

function NewVersionRoute() {
  const recipe = Route.useLoaderData()
  const current = useCurrentUser()
  if (!current) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10 text-gray-400">
        <p role="status">Loading…</p>
      </main>
    )
  }
  if (current.isAnonymous) {
    return (
      <main className="mx-auto max-w-2xl space-y-3 px-4 py-10 text-gray-100">
        <h1 className="font-serif text-3xl font-bold">Sign in to create versions</h1>
        <Link to="/login" className="text-orange-300 underline">
          Sign in
        </Link>
      </main>
    )
  }
  return <RecipeVersionPage recipe={recipe} />
}

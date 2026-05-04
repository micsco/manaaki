import { usePostHog } from "@posthog/react"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useState } from "react"
import type { RecipeSummary } from "../api/generated/types.gen"
import { RecipeCardInfoBadges, RecipeCardToolBadges } from "../components/RecipeCardMeta"
import { RecipeFilterDrawer } from "../components/RecipeFilterDrawer"
import { FilterBar, FilterPills } from "../components/RecipeFilters"
import { Card } from "../components/ui"
import { useRecipeFilters } from "../hooks/useRecipeFilters"
import { recipeListQueryOptions } from "../hooks/useRecipeList"
import { recipeImageUrl, recipeUrl } from "../utils/recipe"

export const Route = createFileRoute("/recipes/")({
  head: () => ({
    meta: [{ title: "Recipes · Manaaki" }],
  }),
  loader: ({ context: { queryClient } }) =>
    void queryClient.ensureQueryData(recipeListQueryOptions),
  component: RecipeList,
})

function RecipeImage({ recipe }: { recipe: RecipeSummary }) {
  const [failed, setFailed] = useState(false)
  const img = recipeImageUrl(recipe.id, "min-original", recipe.image)

  return (
    <div className="relative h-48 w-full">
      {img && !failed ? (
        <img
          src={img}
          alt={recipe.name ?? ""}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="h-full w-full bg-gray-800" aria-hidden="true" />
      )}
      <div className="absolute top-0 right-0 p-2">
        <RecipeCardToolBadges recipe={recipe} />
      </div>
      <div className="absolute right-0 bottom-0 left-0 bg-gradient-to-t from-black/70 to-transparent px-3 pt-6 pb-2">
        <RecipeCardInfoBadges recipe={recipe} />
      </div>
    </div>
  )
}

function RecipeCard({ recipe }: { recipe: RecipeSummary }) {
  const posthog = usePostHog()

  return (
    <Card hover className="overflow-hidden">
      {recipe.id && recipe.slug ? (
        <Link
          to={recipeUrl(recipe.id, recipe.slug)}
          className="block rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-gray-950"
          onClick={() =>
            posthog.capture("recipe_card_clicked", {
              recipe_id: recipe.id,
              recipe_name: recipe.name,
              recipe_rating: recipe.rating,
              recipe_total_time: recipe.totalTime,
            })
          }
        >
          <RecipeImage recipe={recipe} />
          <div className="p-4">
            <h3 className="line-clamp-2 font-semibold text-gray-100 text-lg">{recipe.name}</h3>
          </div>
        </Link>
      ) : (
        <div className="p-4">
          <h3 className="line-clamp-2 font-semibold text-gray-100 text-lg">{recipe.name}</h3>
        </div>
      )}
    </Card>
  )
}

function RecipeList() {
  const { data } = useQuery(recipeListQueryOptions)
  const recipes = data ?? []
  const [drawerOpen, setDrawerOpen] = useState(false)

  const {
    search,
    setSearch,
    proteins,
    toggleProtein,
    tools,
    toggleTool,
    time,
    setTimeBucket,
    activeFilterCount,
    clearAll,
    filtered,
  } = useRecipeFilters(recipes)

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "instant" })
  }

  function handleSearchChange(value: string) {
    setSearch(value)
    scrollToTop()
  }

  function handleToggleProtein(value: string) {
    toggleProtein(value)
    scrollToTop()
  }

  function handleToggleTool(value: string) {
    toggleTool(value)
    scrollToTop()
  }

  function handleSetTimeBucket(value: Parameters<typeof setTimeBucket>[0]) {
    setTimeBucket(value)
    scrollToTop()
  }

  function handleClearAll() {
    clearAll()
    scrollToTop()
  }

  const isFiltered = activeFilterCount > 0

  return (
    <main className="min-h-screen bg-gray-950">
      <div className="mx-auto max-w-7xl px-4 py-8 pb-44">
        <div className="mb-6">
          <h1 className="mb-1 font-bold text-4xl text-gray-100">Recipes</h1>
          <p className="text-gray-400 text-sm">
            {isFiltered
              ? `${filtered.length} of ${recipes.length} recipes`
              : `${recipes.length} recipes`}
          </p>
        </div>

        {filtered.length === 0 && isFiltered ? (
          <div className="flex flex-col items-center gap-4 py-20 text-center">
            <p className="text-gray-400 text-lg">No recipes match your filters.</p>
            <button
              type="button"
              onClick={handleClearAll}
              className="text-orange-400 text-sm hover:text-orange-300 focus:underline focus:outline-none"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map(recipe => (
              <RecipeCard key={recipe.id ?? recipe.slug} recipe={recipe} />
            ))}
          </div>
        )}
      </div>

      <div className="fixed right-0 bottom-[68px] left-0 z-30 px-4 pb-2">
        <div className="mx-auto max-w-7xl">
          <FilterPills
            proteins={proteins}
            onToggleProtein={handleToggleProtein}
            tools={tools}
            onToggleTool={handleToggleTool}
          />
        </div>
      </div>

      <div
        className={[
          "fixed right-0 bottom-0 left-0 z-30",
          "border-gray-800 border-t",
          "bg-gray-950/90 backdrop-blur-md supports-[not_(backdrop-filter:blur(1px))]:bg-gray-950",
        ].join(" ")}
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="mx-auto max-w-7xl px-4 py-3">
          <FilterBar
            search={search}
            onSearchChange={handleSearchChange}
            activeFilterCount={activeFilterCount}
            onOpenDrawer={() => setDrawerOpen(true)}
          />
        </div>
      </div>

      <RecipeFilterDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        proteins={proteins}
        onToggleProtein={handleToggleProtein}
        tools={tools}
        onToggleTool={handleToggleTool}
        time={time}
        onSetTime={handleSetTimeBucket}
        activeFilterCount={activeFilterCount}
        onClearAll={handleClearAll}
      />
    </main>
  )
}

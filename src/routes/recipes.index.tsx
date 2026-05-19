import { mdiPotSteam } from "@mdi/js"
import { usePostHog } from "@posthog/react"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import type { RecipeSummary } from "../api/generated/types.gen"
import { AboutModal } from "../components/AboutModal"
import { Icon } from "../components/Icon"
import {
  RecipeCardInfoBadges,
  RecipeCardTimeBadge,
  RecipeCardToolBadges,
} from "../components/RecipeCardMeta"
import { RecipeFilterDrawer } from "../components/RecipeFilterDrawer"
import { FilterBar, FilterPills } from "../components/RecipeFilters"
import { Card } from "../components/ui"
import { useRecipeFilters } from "../hooks/useRecipeFilters"
import { recipeListQueryOptions } from "../hooks/useRecipeList"
import ManaakiLogo from "../manaaki.svg?react"
import { recipeImageUrl, recipeUrl } from "../utils/recipe"

export const Route = createFileRoute("/recipes/")({
  head: () => {
    const title = "Recipes · Manaaki"
    const description = "Manaaki - An alternative, high-performance web frontend for Mealie."

    const resolveAbsoluteUrl = (path: string | null | undefined): string => {
      if (!path) return ""
      if (path.startsWith("http://") || path.startsWith("https://")) return path
      const host =
        typeof window !== "undefined"
          ? window.location.origin
          : process.env.VITE_PUBLIC_APP_URL || "https://manaaki.scottfamily.nz"
      return `${host}${path}`
    }

    const ogImage = resolveAbsoluteUrl("/manaaki-512.png")
    const ogUrl = resolveAbsoluteUrl("/recipes")

    return {
      meta: [
        { title },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:image", content: ogImage },
        { property: "og:url", content: ogUrl },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: ogImage },
      ],
    }
  },
  loader: ({ context: { queryClient } }) =>
    // biome-ignore lint/suspicious/noEmptyBlockStatements: swallow fetch errors during SSR prerender (no base URL in Node)
    void queryClient.ensureQueryData(recipeListQueryOptions).catch(_e => {}),
  component: RecipeList,
  pendingComponent: RecipeListSkeleton,
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
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
      <div className="absolute top-0 left-0 p-2">
        <RecipeCardTimeBadge recipe={recipe} />
      </div>
      <div className="absolute top-0 right-0 p-2">
        <RecipeCardToolBadges recipe={recipe} />
      </div>
      <div className="absolute right-0 bottom-0 left-0 px-3 pb-2.5">
        <div className="flex items-end justify-between gap-2">
          <h3 className="line-clamp-2 text-balance font-bold text-base text-white leading-tight drop-shadow">
            {recipe.name}
          </h3>
          <RecipeCardInfoBadges recipe={recipe} />
        </div>
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
        </Link>
      ) : (
        <RecipeImage recipe={recipe} />
      )}
    </Card>
  )
}

function RecipeListEndMarker() {
  return (
    <div className="col-span-full flex h-48 flex-col items-center justify-center gap-3">
      <Icon path={mdiPotSteam} size={1.75} className="text-gray-700" aria-hidden={true} />
      <p className="text-gray-600 text-sm">That's all the recipes</p>
      <p className="text-gray-700 text-xs">All out of scroll. Time to decide.</p>
    </div>
  )
}

const SKELETON_CARD_COUNT = 12

function RecipeCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="relative h-48 w-full animate-pulse bg-gray-800" aria-hidden="true">
        <div className="absolute top-0 left-0 p-2">
          <div className="h-5 w-10 rounded-full bg-gray-700" />
        </div>
        <div className="absolute right-0 bottom-0 left-0 px-3 pb-2.5">
          <div className="h-4 w-3/4 rounded bg-gray-700" />
          <div className="mt-1.5 h-4 w-1/2 rounded bg-gray-700" />
        </div>
      </div>
    </Card>
  )
}

function RecipeListSkeleton() {
  return (
    <main className="min-h-screen bg-gray-950">
      <div className="mx-auto max-w-7xl px-4 pt-5 pb-56">
        <div className="mb-6 flex items-center gap-2.5 text-gray-400">
          <ManaakiLogo className="size-8 shrink-0" />
          <h1 className="font-bold text-4xl leading-none">Manaaki</h1>
        </div>

        <div
          role="status"
          aria-label="Loading recipes"
          className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          {Array.from({ length: SKELETON_CARD_COUNT }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list, order never changes
            <RecipeCardSkeleton key={i} />
          ))}
        </div>
      </div>

      <div className="fixed right-0 bottom-[68px] left-0 z-30 px-4 pb-1">
        <div className="mx-auto max-w-7xl">
          <FilterPills
            proteins={[]}
            onToggleProtein={() => undefined}
            tools={[]}
            onToggleTool={() => undefined}
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
            search=""
            onSearchChange={() => undefined}
            activeFilterCount={0}
            onOpenDrawer={() => undefined}
          />
        </div>
      </div>
    </main>
  )
}

function RecipeList() {
  const { data, isLoading } = useQuery(recipeListQueryOptions)
  const recipes = data ?? []
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const showSkeleton = isLoading || !isMounted

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
      <div className="mx-auto max-w-7xl px-4 pt-5 pb-56">
        <div className="mb-6 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => setAboutOpen(true)}
            aria-label="About Manaaki"
            className="flex items-center gap-2.5 rounded-lg text-gray-400 transition-colors hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-gray-950"
          >
            <ManaakiLogo className="size-8 shrink-0" />
            <h1 className="font-bold text-4xl leading-none">Manaaki</h1>
          </button>
          {!showSkeleton && (
            <p className="shrink-0 text-gray-500 text-sm">
              {isFiltered ? `${filtered.length} of ${recipes.length}` : `${recipes.length} recipes`}
            </p>
          )}
        </div>

        {showSkeleton ? (
          <div
            role="status"
            aria-label="Loading recipes"
            className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          >
            {Array.from({ length: SKELETON_CARD_COUNT }, (_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list, order never changes
              <RecipeCardSkeleton key={i} />
            ))}
          </div>
        ) : filtered.length === 0 && isFiltered ? (
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
            <RecipeListEndMarker />
          </div>
        )}
      </div>

      <div className="fixed right-0 bottom-[68px] left-0 z-30 px-4 pb-1">
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

      <AboutModal open={aboutOpen} onOpenChange={setAboutOpen} />
    </main>
  )
}

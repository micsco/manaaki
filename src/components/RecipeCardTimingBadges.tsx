import { Popover } from "@base-ui/react/popover"
import { mdiFire } from "@mdi/js"
import { useQuery } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"

import { getOneApiRecipesSlugGet } from "../api/generated/sdk.gen"
import type { RecipeSummary } from "../api/generated/types.gen"
import { Icon } from "./Icon"
import { RecipeCardTimeBadge } from "./RecipeCardMeta"

export function RecipeCardTimingBadges({ recipe }: { recipe: RecipeSummary }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const lookup = recipe.id || recipe.slug

  useEffect(() => {
    const element = containerRef.current
    if (!element || typeof IntersectionObserver === "undefined") return
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setVisible(true)
        observer.disconnect()
      }
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const { data } = useQuery({
    queryKey: ["recipes", "card-nutrition", lookup, recipe.updatedAt],
    queryFn: async () => {
      if (!lookup) return null
      const response = await getOneApiRecipesSlugGet({ path: { slug: lookup } })
      if (!response.data) throw new Error("Unable to load recipe nutrition")
      return {
        nutrition: response.data.nutrition,
        showNutrition: response.data.settings?.showNutrition,
      }
    },
    enabled: visible && !!lookup,
    staleTime: 5 * 60_000,
    retry: false,
  })
  const calories = Number.parseFloat(data?.nutrition?.calories ?? "")
  const showCalories = data?.showNutrition && Number.isFinite(calories) && calories >= 0

  return (
    <div ref={containerRef} className="flex flex-wrap items-start gap-1.5">
      <RecipeCardTimeBadge recipe={recipe} />
      {showCalories ? (
        <Popover.Root>
          <Popover.Trigger
            openOnHover
            aria-label={`${Math.round(calories)} calories per serving`}
            className="flex items-center gap-1 rounded-full border border-white/10 bg-black/40 px-2 py-0.5 text-xs font-medium text-white backdrop-blur-xs focus-visible:outline-2 focus-visible:outline-orange-400"
          >
            <Icon path={mdiFire} size={0.55} aria-hidden />
            {Math.round(calories)}
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner side="bottom" sideOffset={8}>
              <Popover.Popup className="z-40 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white shadow-lg">
                <Popover.Title>{Math.round(calories)} calories per serving</Popover.Title>
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      ) : null}
    </div>
  )
}

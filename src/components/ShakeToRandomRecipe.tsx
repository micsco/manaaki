import { mdiShuffle } from "@mdi/js"
import { usePostHog } from "@posthog/react"
import { useNavigate } from "@tanstack/react-router"
import { useCallback, useEffect, useRef, useState } from "react"
import { useMotionPermission } from "../hooks/useMotionPermission"
import { useRecipeList } from "../hooks/useRecipeList"
import { useShakeDetection } from "../hooks/useShakeDetection"
import { recipeUrl } from "../utils/recipe"
import { Icon } from "./Icon"

const COUNTDOWN_MS = 5000

export function ShakeToRandomRecipe() {
  const { state: permissionState, request: requestPermission } = useMotionPermission()
  const [active, setActive] = useState(false)
  const recipes = useRecipeList()
  const navigate = useNavigate()
  const posthog = usePostHog()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const randomRecipeRef = useRef<{ id: string; slug: string; name: string } | null>(null)
  const recipesRef = useRef(recipes)
  recipesRef.current = recipes

  const handleShake = useCallback(() => {
    if (timerRef.current !== null) return

    const eligible = recipesRef.current.filter((r): r is typeof r & { id: string; slug: string } =>
      Boolean(r.id && r.slug)
    )
    if (eligible.length === 0) return

    const pick = eligible[Math.floor(Math.random() * eligible.length)]
    const picked = { id: pick.id, slug: pick.slug, name: pick.name ?? "" }
    randomRecipeRef.current = picked
    setActive(true)

    posthog.capture("shake_random_recipe_triggered", {
      recipe_id: picked.id,
      recipe_name: picked.name,
      total_recipes: recipesRef.current.length,
    })

    timerRef.current = setTimeout(() => {
      timerRef.current = null
      setActive(false)
      posthog.capture("shake_random_recipe_navigated", {
        recipe_id: picked.id,
        recipe_name: picked.name,
      })
      navigate({ to: recipeUrl(picked.id, picked.slug) })
    }, COUNTDOWN_MS)
  }, [navigate, posthog])

  function handleCancel() {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setActive(false)
    posthog.capture("shake_random_recipe_cancelled", {
      recipe_id: randomRecipeRef.current?.id,
      recipe_name: randomRecipeRef.current?.name,
    })
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  useShakeDetection({ onShake: handleShake, enabled: permissionState === "granted" })

  if (permissionState === "unavailable") return null

  if (permissionState === "prompt") {
    return (
      <div
        className="fixed right-0 bottom-20 left-0 z-40 flex justify-center px-4 pb-2"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.5rem)" }}
      >
        <button
          type="button"
          onClick={requestPermission}
          className="flex items-center gap-2.5 rounded-full bg-gray-900/90 px-4 py-2.5 text-gray-400 text-sm backdrop-blur-sm transition-colors hover:bg-gray-800 hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-gray-950"
        >
          <Icon path={mdiShuffle} size={0.75} aria-hidden={true} />
          Shake for a random recipe · Enable
        </button>
      </div>
    )
  }

  if (!active) return null

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gray-950/95 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Finding a random recipe"
    >
      <div className="flex flex-col items-center gap-6 px-8 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-orange-600/20 text-orange-400">
          <Icon path={mdiShuffle} size={2.5} aria-hidden={true} />
        </div>

        <div className="flex flex-col gap-2">
          <p className="font-bold text-2xl text-white">Random Recipe</p>
          <p className="text-gray-400 text-sm">{randomRecipeRef.current?.name ?? ""}</p>
        </div>

        <div className="w-64 overflow-hidden rounded-full bg-gray-800">
          <div
            className="h-1.5 rounded-full bg-orange-500"
            style={{
              animation: `shrink-bar ${COUNTDOWN_MS}ms linear forwards`,
            }}
          />
        </div>

        <button
          type="button"
          onClick={handleCancel}
          className="rounded-full bg-gray-800 px-6 py-3 font-medium text-gray-300 text-sm transition-colors hover:bg-gray-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-950"
        >
          Tap to cancel
        </button>
      </div>

      <style>{`
        @keyframes shrink-bar {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  )
}

import { mdiShuffle } from "@mdi/js"
import { usePostHog } from "@posthog/react"
import { useNavigate } from "@tanstack/react-router"
import { useCallback, useEffect, useRef, useState } from "react"
import { useMotionPermissionContext } from "../contexts/MotionPermissionContext"
import { useRecipeList } from "../hooks/useRecipeList"
import { useShakeDetection } from "../hooks/useShakeDetection"
import { recipeImageUrl, recipeUrl } from "../utils/recipe"
import { Icon } from "./Icon"

const COUNTDOWN_MS = 5000

type PickedRecipe = { id: string; slug: string; name: string; image: unknown }

export function ShakeToRandomRecipe() {
  const { state: permissionState } = useMotionPermissionContext()
  const [active, setActive] = useState(false)
  const [pickedRecipe, setPickedRecipe] = useState<PickedRecipe | null>(null)
  const [imageFailed, setImageFailed] = useState(false)
  const recipes = useRecipeList()
  const navigate = useNavigate()
  const posthog = usePostHog()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const recipesRef = useRef(recipes)
  recipesRef.current = recipes

  const handleShake = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }

    const eligible = recipesRef.current.filter((r): r is typeof r & { id: string; slug: string } =>
      Boolean(r.id && r.slug)
    )
    if (eligible.length === 0) return

    const pick = eligible[Math.floor(Math.random() * eligible.length)]
    const picked: PickedRecipe = {
      id: pick.id,
      slug: pick.slug,
      name: pick.name ?? "",
      image: pick.image,
    }
    setPickedRecipe(picked)
    setImageFailed(false)
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
      recipe_id: pickedRecipe?.id,
      recipe_name: pickedRecipe?.name,
    })
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  useShakeDetection({ onShake: handleShake, enabled: permissionState === "granted" })

  if (permissionState !== "granted" || !active || !pickedRecipe) return null

  const imgSrc = recipeImageUrl(pickedRecipe.id, "min-original", pickedRecipe.image)

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Finding a random recipe"
    >
      {imgSrc && !imageFailed ? (
        <img
          key={pickedRecipe.id}
          src={imgSrc}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
          style={{ animation: "recipe-fade-in 0.4s ease-out forwards" }}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div className="absolute inset-0 bg-gray-900" aria-hidden="true" />
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/20" />

      <div className="absolute inset-0 flex flex-col items-center justify-between px-6 pt-12 pb-0">
        <div className="flex items-center gap-2 text-orange-400">
          <Icon path={mdiShuffle} size={1} aria-hidden={true} />
          <span className="font-semibold text-sm uppercase tracking-widest">Random Recipe</span>
        </div>

        <div
          key={pickedRecipe.id}
          className="flex flex-col items-center gap-3 text-center"
          style={{ animation: "recipe-slide-up 0.35s ease-out forwards" }}
        >
          <p className="font-bold text-3xl text-white leading-tight drop-shadow-lg [text-shadow:0_2px_12px_rgba(0,0,0,0.8)]">
            {pickedRecipe.name}
          </p>
          <p className="text-orange-300/80 text-xs uppercase tracking-widest">
            Shake again to reshuffle
          </p>
        </div>

        <div className="flex w-full flex-col items-center gap-5 pb-10">
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-full bg-white/10 px-7 py-3 font-medium text-sm text-white backdrop-blur-sm transition-colors hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50"
          >
            Cancel
          </button>

          <div className="w-full overflow-hidden rounded-full bg-white/20">
            <div
              key={pickedRecipe.id}
              className="h-1 rounded-full bg-orange-500"
              style={{
                animation: `shrink-bar ${COUNTDOWN_MS}ms linear forwards`,
              }}
            />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes shrink-bar {
          from { width: 100%; }
          to { width: 0%; }
        }
        @keyframes recipe-fade-in {
          from { opacity: 0; transform: scale(1.04); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes recipe-slide-up {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

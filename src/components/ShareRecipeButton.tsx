import { mdiShareVariant } from "@mdi/js"
import { usePostHog } from "@posthog/react"
import { useEffect, useState } from "react"
import type { RecipeOutput } from "../api/generated/types.gen"
import { Icon } from "./Icon"

export function ShareRecipeButton({ recipe }: { recipe: RecipeOutput }) {
  const posthog = usePostHog()
  // Render nothing during SSR and the first client paint, then feature-detect
  // after mount. This avoids a hydration mismatch and hides the button where
  // the Web Share API is unavailable (e.g. desktop browsers), which still have
  // their own browser chrome for sharing.
  const [supported, setSupported] = useState(false)
  useEffect(() => {
    setSupported(typeof navigator !== "undefined" && typeof navigator.share === "function")
  }, [])

  if (!supported) return null

  const handleShare = async () => {
    try {
      await navigator.share({ title: recipe.name ?? "Recipe", url: window.location.href })
      posthog.capture("recipe_shared", {
        recipe_id: recipe.id,
        recipe_name: recipe.name,
      })
    } catch (err) {
      // The user dismissing the share sheet rejects with AbortError; ignore it.
      // Other failures are non-fatal — nothing to recover, so stay silent.
      if (err instanceof Error && err.name === "AbortError") return
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      aria-label="Share recipe"
      className="inline-flex items-center justify-center rounded-full bg-black/40 p-1.5 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
    >
      <Icon path={mdiShareVariant} size={0.75} aria-hidden={true} />
    </button>
  )
}

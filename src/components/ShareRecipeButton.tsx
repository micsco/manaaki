import { Dialog } from "@base-ui/react/dialog"
import { mdiCheck, mdiLinkVariant, mdiShareVariant } from "@mdi/js"
import { usePostHog } from "@posthog/react"
import { useHydrated } from "@tanstack/react-router"
import { useState } from "react"

import type { RecipeOutput } from "../api/generated/types.gen"
import { Icon } from "./Icon"
import { Button } from "./ui/Button"

export function ShareRecipeButton({ recipe }: { recipe: RecipeOutput }) {
  const posthog = usePostHog()
  const hydrated = useHydrated()
  const supported = hydrated && typeof navigator.share === "function"
  const [copied, setCopied] = useState(false)
  const [manualLink, setManualLink] = useState("")

  async function handleShare() {
    const url = new URL(window.location.href)
    url.search = ""
    url.hash = ""
    try {
      if (supported) await navigator.share({ title: recipe.name ?? "Recipe", url: url.href })
      else {
        await navigator.clipboard.writeText(url.href)
        setCopied(true)
      }
      posthog.capture("recipe_shared", {
        recipe_id: recipe.id,
        recipe_name: recipe.name,
        method: supported ? "share" : "copy",
      })
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return
      setManualLink(url.href)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleShare}
        aria-label={copied ? "Recipe link copied" : supported ? "Share recipe" : "Copy recipe link"}
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-black/40 p-2.5 text-white backdrop-blur-xs transition-colors hover:bg-black/60 focus-visible:outline-2 focus-visible:outline-orange-400"
      >
        <Icon
          path={copied ? mdiCheck : supported ? mdiShareVariant : mdiLinkVariant}
          size={0.75}
          aria-hidden
        />
      </button>
      <span role="status" className="sr-only">
        {copied ? "Recipe link copied" : ""}
      </span>
      <Dialog.Root
        open={!!manualLink}
        onOpenChange={open => {
          if (!open) setManualLink("")
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/60" />
          <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-gray-800 bg-gray-900 p-6 text-gray-100">
            <Dialog.Title className="text-xl font-semibold">Copy recipe link</Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-gray-400">
              Copy this link to share the recipe.
            </Dialog.Description>
            <input
              aria-label="Recipe link"
              readOnly
              value={manualLink}
              onFocus={event => event.target.select()}
              className="my-4 min-h-11 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 text-base"
            />
            <Dialog.Close
              render={
                <Button variant="secondary" className="min-h-11">
                  Done
                </Button>
              }
            >
              Done
            </Dialog.Close>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}

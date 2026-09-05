import { Dialog } from "@base-ui/react/dialog"
import {
  mdiAlertCircleOutline,
  mdiBookPlus,
  mdiClose,
  mdiContentPaste,
  mdiLoading,
  mdiLockOutline,
} from "@mdi/js"
import { usePostHog } from "@posthog/react"
import { useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"

import { useCurrentUser } from "../hooks/useCurrentUser"
import { useImportRecipe } from "../hooks/useImportRecipe"
import { toastManager } from "../lib/toastManager"
import { Icon } from "./Icon"

export interface ImportRecipeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function normalizeRecipeUrl(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  let candidate = trimmed
  if (!/^https?:\/\//i.test(trimmed)) {
    if (trimmed.includes("://")) return null
    candidate = `https://${trimmed}`
  }
  try {
    const parsed = new URL(candidate)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null
    if (!parsed.hostname || !parsed.hostname.includes(".")) return null
    return parsed.href
  } catch {
    return null
  }
}

export function ImportRecipeModal({ open, onOpenChange }: ImportRecipeModalProps) {
  const [url, setUrl] = useState("")
  const [validationError, setValidationError] = useState<string | null>(null)
  const current = useCurrentUser()
  const importRecipe = useImportRecipe()
  const navigate = useNavigate()
  const posthog = usePostHog()

  const hasClipboard =
    typeof navigator !== "undefined" && typeof navigator.clipboard?.readText === "function"

  useEffect(() => {
    if (open) {
      posthog.capture("recipe_import_opened")
    }
  }, [open, posthog])

  function resetState() {
    setUrl("")
    setValidationError(null)
    importRecipe.reset()
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      resetState()
    }
    onOpenChange(nextOpen)
  }

  async function handlePaste() {
    try {
      const clipboardText = await navigator.clipboard.readText()
      if (clipboardText) {
        setUrl(clipboardText.trim())
        setValidationError(null)
      }
    } catch {
      const inputElement = document.getElementById("recipe-url")
      inputElement?.focus()
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const normalizedUrl = normalizeRecipeUrl(url)

    if (!normalizedUrl) {
      setValidationError(
        "Please enter a valid recipe web address (e.g. https://www.bbcgoodfood.com/recipes/...)"
      )
      return
    }

    setValidationError(null)
    posthog.capture("recipe_import_submitted", { url: normalizedUrl })

    try {
      const slug = await importRecipe.mutateAsync({ url: normalizedUrl })
      posthog.capture("recipe_import_succeeded", { url: normalizedUrl, slug })
      toastManager.add({
        title: "Recipe imported!",
        description: "Opening your new recipe now.",
      })
      handleOpenChange(false)
      await navigate({ to: "/recipes/$slug", params: { slug } })
    } catch (error) {
      posthog.capture("recipe_import_failed", {
        url: normalizedUrl,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const isAnonymous = !current || current.isAnonymous
  const errorMessage =
    validationError ??
    (importRecipe.error instanceof Error
      ? importRecipe.error.message
      : importRecipe.error
        ? "Unable to scrape recipe."
        : null)

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 max-h-[90vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-xl focus:outline-hidden">
          <div className="flex items-center justify-between pb-4">
            <Dialog.Title className="flex items-center gap-2.5 text-xl font-semibold text-gray-100">
              <Icon path={mdiBookPlus} size={0.8} className="text-orange-500" aria-hidden={true} />
              Import Recipe
            </Dialog.Title>
            <Dialog.Close
              className="flex h-11 w-11 items-center justify-center rounded-full text-gray-400 hover:bg-gray-800 hover:text-gray-200 focus:ring-2 focus:ring-orange-500 focus:outline-hidden"
              aria-label="Close"
              disabled={importRecipe.isPending}
            >
              <Icon path={mdiClose} size={0.7} aria-hidden={true} />
            </Dialog.Close>
          </div>

          {isAnonymous ? (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-600/20 text-orange-400">
                <Icon path={mdiLockOutline} size={1} aria-hidden={true} />
              </div>
              <Dialog.Description className="max-w-sm text-sm leading-relaxed text-gray-300">
                Sign in to import recipes directly into your Mealie collection from any website.
              </Dialog.Description>
              <div className="flex w-full flex-col gap-2.5 pt-2 sm:flex-row sm:justify-center">
                <a
                  href="/api/auth/oauth"
                  className="inline-flex min-h-11 items-center justify-center rounded-xl bg-orange-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-orange-500"
                >
                  Sign in with Mealie
                </a>
                <button
                  type="button"
                  onClick={() => handleOpenChange(false)}
                  className="min-h-11 rounded-xl border border-gray-700 px-5 py-2.5 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Dialog.Description className="text-sm leading-relaxed text-gray-400">
                Paste a web link to import ingredients, instructions, and photos automatically into
                your recipe collection.
              </Dialog.Description>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="recipe-url" className="text-sm font-medium text-gray-200">
                    Recipe URL
                  </label>
                  {hasClipboard && (
                    <button
                      type="button"
                      onClick={handlePaste}
                      disabled={importRecipe.isPending}
                      className="inline-flex min-h-11 items-center gap-1.5 px-2 text-xs font-medium text-orange-400 transition-colors hover:text-orange-300 disabled:opacity-50"
                    >
                      <Icon path={mdiContentPaste} size={0.65} aria-hidden={true} />
                      Paste
                    </button>
                  )}
                </div>

                <div className="relative">
                  <input
                    id="recipe-url"
                    type="text"
                    value={url}
                    onChange={event => {
                      setUrl(event.target.value)
                      if (validationError) setValidationError(null)
                    }}
                    placeholder="https://www.bbcgoodfood.com/recipes/..."
                    disabled={importRecipe.isPending}
                    className="min-h-12 w-full rounded-xl border border-gray-700 bg-gray-800/80 px-4 py-2.5 text-base text-gray-100 placeholder:text-gray-500 focus:border-orange-500 focus:ring-2 focus:ring-orange-500 focus:outline-hidden disabled:opacity-50"
                  />
                  {url.length > 0 && !importRecipe.isPending && (
                    <button
                      type="button"
                      onClick={() => {
                        setUrl("")
                        setValidationError(null)
                      }}
                      className="absolute top-1/2 right-2.5 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 hover:text-gray-200"
                      aria-label="Clear URL"
                    >
                      <Icon path={mdiClose} size={0.6} aria-hidden={true} />
                    </button>
                  )}
                </div>

                <p className="text-xs text-gray-400">
                  Supports BBC Good Food, NYT Cooking, Serious Eats, King Arthur, RecipeTin Eats,
                  and hundreds of other recipe sites.
                </p>
              </div>

              {errorMessage && (
                <div
                  role="alert"
                  className="flex items-start gap-3 rounded-xl border border-red-900/50 bg-red-950/40 p-3.5 text-sm text-red-200"
                >
                  <Icon
                    path={mdiAlertCircleOutline}
                    size={0.75}
                    className="mt-0.5 shrink-0 text-red-400"
                    aria-hidden={true}
                  />
                  <span>{errorMessage}</span>
                </div>
              )}

              {importRecipe.isPending && (
                <div className="flex items-center gap-2.5 rounded-xl border border-orange-900/40 bg-orange-950/30 p-3 text-sm text-orange-200">
                  <Icon
                    path={mdiLoading}
                    size={0.75}
                    className="shrink-0 animate-spin text-orange-400"
                    aria-hidden={true}
                  />
                  <span>Scraping recipe details… this may take a few seconds.</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleOpenChange(false)}
                  disabled={importRecipe.isPending}
                  className="min-h-11 rounded-xl border border-gray-700 px-5 py-2.5 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-800 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={importRecipe.isPending || !url.trim()}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-orange-500 disabled:opacity-50"
                >
                  {importRecipe.isPending ? (
                    <>
                      <Icon
                        path={mdiLoading}
                        size={0.7}
                        className="animate-spin"
                        aria-hidden={true}
                      />
                      Importing…
                    </>
                  ) : (
                    "Import Recipe"
                  )}
                </button>
              </div>
            </form>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

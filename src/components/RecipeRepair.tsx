import { Dialog } from "@base-ui/react/dialog"
import { useQueryClient } from "@tanstack/react-query"
import { useRouter } from "@tanstack/react-router"
import { useState } from "react"

import type { RecipeOutput } from "../api/generated/types.gen"
import { parseRecipeIngredients, renameRecipe, unparsedIngredients } from "../api/recipeParsing"
import { useOnline } from "../pwa/useOnline"

export function RecipeRepair({ recipe }: { recipe: RecipeOutput }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        className="min-h-11 w-full rounded-xl px-4 py-2 text-left text-sm text-gray-200 hover:bg-gray-800"
        onClick={() => setOpen(true)}
      >
        Review title and ingredients
      </button>
      {open && <RecipeRepairDialog recipe={recipe} onClose={() => setOpen(false)} />}
    </>
  )
}

function RecipeRepairDialog({ recipe, onClose }: { recipe: RecipeOutput; onClose: () => void }) {
  const [name, setName] = useState(recipe.name ?? "")
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [remaining, setRemaining] = useState(unparsedIngredients(recipe).length)
  const router = useRouter()
  const queryClient = useQueryClient()
  const online = useOnline()
  async function update(action: "title" | "ingredients") {
    const slug = recipe.id || recipe.slug
    if (!slug || !online || pending) return
    setPending(true)
    setError("")
    setMessage("")
    try {
      if (action === "title") await renameRecipe(slug, name)
      else {
        const saved = await parseRecipeIngredients(slug)
        setRemaining(unparsedIngredients(saved).length)
      }
      await queryClient.invalidateQueries({ queryKey: ["recipes"] })
      await router.invalidate()
      setMessage(
        action === "title"
          ? "Title saved."
          : "Ingredients parsed and saved. Review the quantities and matches in the recipe."
      )
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not update the recipe.")
    } finally {
      setPending(false)
    }
  }
  return (
    <Dialog.Root
      open
      onOpenChange={value => {
        if (!value && !pending) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 mobile-dialog max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 space-y-4 overflow-y-auto rounded-2xl border border-gray-800 bg-gray-900 p-6 text-gray-200">
          <Dialog.Title className="text-xl font-semibold">
            Review title and ingredients
          </Dialog.Title>
          <Dialog.Description className="text-sm text-gray-400">
            Check the imported title and use Mealie’s AI parser to separate ingredient quantities,
            foods, and units.
          </Dialog.Description>
          <form
            className="space-y-3"
            onSubmit={event => {
              event.preventDefault()
              void update("title")
            }}
          >
            <label className="block text-sm" htmlFor="recipe-title">
              Recipe title
            </label>
            <input
              id="recipe-title"
              value={name}
              onChange={event => setName(event.target.value)}
              disabled={pending}
              className="min-h-11 w-full rounded-xl border border-gray-700 bg-gray-800 px-3 text-base"
            />
            <button
              disabled={pending || !online || !name.trim()}
              className="min-h-11 rounded-xl bg-orange-600 px-4 disabled:opacity-50"
            >
              Save title
            </button>
          </form>
          <p className="text-sm">
            {remaining
              ? `${remaining} ingredients still need parsing.`
              : "No unparsed ingredients found."}
          </p>
          <button
            disabled={pending || !online || !remaining}
            onClick={() => void update("ingredients")}
            className="min-h-11 rounded-xl bg-orange-600 px-4 disabled:opacity-50"
          >
            Parse ingredients with AI
          </button>
          {!online && <p role="status">Reconnect to update this recipe.</p>}
          {pending && <p role="status">Updating recipe…</p>}
          {message && <p role="status">{message}</p>}
          {error && (
            <p role="alert" className="text-red-300">
              {error}
            </p>
          )}
          <Dialog.Close
            disabled={pending}
            className="min-h-11 rounded-xl border border-gray-700 px-4"
          >
            Done
          </Dialog.Close>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

import { useState } from "react"

import type { RecipeOutput } from "../api/generated/types.gen"
import { LazyRecipeVersionDialog } from "./LazyDialogs"

export function RecipeVersionAction({ recipe }: { recipe: RecipeOutput }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        className="min-h-11 w-full rounded-xl px-4 py-2 text-left text-sm text-gray-200 hover:bg-gray-800"
        onClick={() => setOpen(true)}
      >
        Create another version with AI…
      </button>
      {open && <LazyRecipeVersionDialog recipe={recipe} onClose={() => setOpen(false)} />}
    </>
  )
}

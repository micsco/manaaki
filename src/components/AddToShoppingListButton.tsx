// src/components/AddToShoppingListButton.tsx
import { mdiCartPlus } from "@mdi/js"
import { useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import {
  addRecipeIngredientsToListApiHouseholdsShoppingListsItemIdRecipePost,
  type RecipeOutput,
} from "../api/generated"
import { useCurrentUser } from "../hooks/useCurrentUser"
import { currentListQueryOptions, useCurrentShoppingList } from "../hooks/useShoppingList"
import { buildShoppingList } from "../hooks/useShoppingMutations"
import { Icon } from "./Icon"

const BTN =
  "inline-flex min-h-11 items-center gap-1.5 rounded-full bg-black/40 px-4 py-2 font-medium text-sm text-white backdrop-blur-sm transition-colors hover:bg-black/60"

export function AddToShoppingListButton({ recipe }: { recipe: RecipeOutput }) {
  const current = useCurrentUser()
  const list = useCurrentShoppingList()
  const qc = useQueryClient()
  const [state, setState] = useState<"idle" | "adding" | "done" | "error">("idle")

  if (!current || current.isAnonymous) {
    return (
      <a href="/api/auth/oauth" className={BTN}>
        <Icon path={mdiCartPlus} size={0.75} aria-hidden={true} /> Sign in to add
      </a>
    )
  }

  async function add() {
    if (!recipe.id) return
    setState("adding")
    try {
      let listId = list?.id
      if (!listId) {
        const built = await buildShoppingList({
          name: "Shopping list",
          selections: [{ recipeId: recipe.id, recipeIncrementQuantity: 1 }],
        })
        listId = built.listId
      } else {
        await addRecipeIngredientsToListApiHouseholdsShoppingListsItemIdRecipePost({
          path: { item_id: listId },
          body: [{ recipeId: recipe.id, recipeIncrementQuantity: 1 }],
        })
      }
      qc.invalidateQueries({ queryKey: currentListQueryOptions.queryKey })
      setState("done")
    } catch {
      setState("error")
    }
  }

  return (
    <button
      type="button"
      onClick={add}
      disabled={state === "adding"}
      className={BTN}
      aria-label="Add to shopping list"
    >
      <Icon path={mdiCartPlus} size={0.75} aria-hidden={true} />
      {state === "done" ? "Added" : state === "error" ? "Try again" : "Add to shopping list"}
    </button>
  )
}

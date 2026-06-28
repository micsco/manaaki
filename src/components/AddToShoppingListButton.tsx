// src/components/AddToShoppingListButton.tsx
import { mdiCartPlus } from "@mdi/js"
import { useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import {
  addRecipeIngredientsToListApiHouseholdsShoppingListsItemIdRecipePost,
  type RecipeOutput,
  removeRecipeIngredientsFromListApiHouseholdsShoppingListsItemIdRecipeRecipeIdDeletePost,
} from "../api/generated"
import { useCurrentUser } from "../hooks/useCurrentUser"
import { currentListQueryOptions, useCurrentShoppingList } from "../hooks/useShoppingList"
import { buildShoppingList } from "../hooks/useShoppingMutations"
import { toastManager } from "../lib/toastManager"
import { shouldStartNewList } from "../utils/shopping"
import { Icon } from "./Icon"

const BTN =
  "inline-flex min-h-11 items-center gap-1.5 rounded-full bg-black/40 px-4 py-2 font-medium text-sm text-white backdrop-blur-sm transition-colors hover:bg-black/60"

function newListName(): string {
  return `Shop · ${new Date().toLocaleDateString()}`
}

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

  // Move the recipe out of the existing list into a fresh one (the "New list
  // instead" toast action). Removal from the old list is best-effort.
  async function moveRecipeToNewList(recipeId: string, fromListId: string) {
    const built = await buildShoppingList({
      name: newListName(),
      selections: [{ recipeId, recipeIncrementQuantity: 1 }],
    })
    await removeRecipeIngredientsFromListApiHouseholdsShoppingListsItemIdRecipeRecipeIdDeletePost({
      path: { item_id: fromListId, recipe_id: recipeId },
    }).catch(() => undefined)
    qc.invalidateQueries({ queryKey: currentListQueryOptions.queryKey })
    window.location.assign(`/shopping?list=${built.listId}`)
  }

  async function add() {
    if (!recipe.id) return
    const recipeId = recipe.id
    const recipeName = recipe.name ?? "recipe"
    setState("adding")
    try {
      if (!list?.id || shouldStartNewList(list.createdAt, Date.now())) {
        const built = await buildShoppingList({
          name: newListName(),
          selections: [{ recipeId, recipeIncrementQuantity: 1 }],
        })
        toastManager.add({
          title: "Started a new shopping list",
          description: `Added ${recipeName}.`,
          actionProps: {
            children: "View list",
            onClick: () => window.location.assign(`/shopping?list=${built.listId}`),
          },
        })
      } else {
        const currentId = list.id
        const res = await addRecipeIngredientsToListApiHouseholdsShoppingListsItemIdRecipePost({
          path: { item_id: currentId },
          body: [{ recipeId, recipeIncrementQuantity: 1 }],
        })
        if (res.error) throw res.error
        toastManager.add({
          title: `Added ${recipeName} to your list`,
          actionProps: {
            children: "New list instead",
            onClick: () => {
              void moveRecipeToNewList(recipeId, currentId)
            },
          },
        })
      }
      qc.invalidateQueries({ queryKey: currentListQueryOptions.queryKey })
      setState("done")
    } catch {
      toastManager.add({ title: "Couldn't add to your shopping list" })
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

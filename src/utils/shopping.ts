import type {
  ReadPlanEntry,
  ShoppingListItemOutOutput,
  ShoppingListItemUpdate,
  ShoppingListMultiPurposeLabelOut,
} from "../api/generated"
import { toIsoDateString } from "../hooks/useMealPlan"

export type GatheredRecipe = {
  recipeId: string
  name: string
  baseServings: number | null
  occurrences: number
}

export function shoppingDayRange(today: Date, days: number): { start: string; end: string } {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const end = new Date(start)
  end.setDate(start.getDate() + (days - 1))
  return { start: toIsoDateString(start), end: toIsoDateString(end) }
}

export function gatherPlanRecipes(entries: ReadPlanEntry[]): GatheredRecipe[] {
  const byId = new Map<string, GatheredRecipe>()
  for (const e of entries) {
    const recipeId = e.recipeId ?? e.recipe?.id ?? null
    if (!recipeId) continue
    const existing = byId.get(recipeId)
    if (existing) {
      existing.occurrences += 1
      continue
    }
    byId.set(recipeId, {
      recipeId,
      name: e.recipe?.name ?? e.title ?? "Recipe",
      baseServings: typeof e.recipe?.recipeServings === "number" ? e.recipe.recipeServings : null,
      occurrences: 1,
    })
  }
  return [...byId.values()]
}

export function computeRecipeIncrement(args: {
  mode: "servings" | "multiplier"
  value: number
  baseServings: number | null
}): number {
  if (args.mode === "multiplier") return args.value
  if (args.baseServings && args.baseServings > 0) return args.value / args.baseServings
  return args.value
}

// Map a response item to an update payload: ONLY accepted scalar/id fields.
// Never spread the output object (its food/unit/label are Output types the
// Update schema doesn't accept; id/groupId/etc. are response-only).
export function itemUpdateFromOutput(
  item: ShoppingListItemOutOutput,
  patch: { checked?: boolean }
): ShoppingListItemUpdate {
  const update: ShoppingListItemUpdate = { shoppingListId: item.shoppingListId }
  if (item.quantity !== undefined) update.quantity = item.quantity
  if (item.note !== undefined) update.note = item.note
  if (item.display !== undefined) update.display = item.display
  if (item.position !== undefined) update.position = item.position
  if (item.foodId !== undefined) update.foodId = item.foodId
  if (item.labelId !== undefined) update.labelId = item.labelId
  if (item.unitId !== undefined) update.unitId = item.unitId
  update.checked = patch.checked ?? item.checked ?? false
  return update
}

export type AisleGroup = {
  labelId: string | null
  name: string
  items: ShoppingListItemOutOutput[]
}

export function groupItemsByAisle(
  items: ShoppingListItemOutOutput[],
  labelSettings: ShoppingListMultiPurposeLabelOut[]
): AisleGroup[] {
  const position = new Map<string, number>()
  for (const s of labelSettings) position.set(s.labelId, s.position ?? Number.MAX_SAFE_INTEGER)

  const groups = new Map<string, AisleGroup>()
  for (const it of items) {
    const labelId = it.labelId ?? null
    const key = labelId ?? "__none__"
    let group = groups.get(key)
    if (!group) {
      group = { labelId, name: labelId ? (it.label?.name ?? "Other") : "Other", items: [] }
      groups.set(key, group)
    }
    group.items.push(it)
  }

  return [...groups.values()].sort((a, b) => {
    const pa = a.labelId
      ? (position.get(a.labelId) ?? Number.MAX_SAFE_INTEGER)
      : Number.MAX_SAFE_INTEGER
    const pb = b.labelId
      ? (position.get(b.labelId) ?? Number.MAX_SAFE_INTEGER)
      : Number.MAX_SAFE_INTEGER
    if (pa !== pb) return pa - pb
    return a.name.localeCompare(b.name)
  })
}

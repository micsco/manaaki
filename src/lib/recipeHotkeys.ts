import { formatForDisplay, type Hotkey } from "@tanstack/react-hotkeys"

import type { RecipeNavDirection } from "./recipeTransition"

export const recipeNavHotkeys = {
  prev: "ArrowLeft",
  next: "ArrowRight",
} as const satisfies Record<RecipeNavDirection, Hotkey>

export const recipeNavHotkeyLabels = {
  prev: formatForDisplay(recipeNavHotkeys.prev),
  next: formatForDisplay(recipeNavHotkeys.next),
} satisfies Record<RecipeNavDirection, string>

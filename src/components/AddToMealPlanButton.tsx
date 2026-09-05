import { useState } from "react"

import type { RecipeOutput } from "../api/generated/types.gen"
import { useCurrentUser } from "../hooks/useCurrentUser"
import { todayIsoDateString } from "../hooks/useMealPlan"
import { MealPlanDialog } from "./MealPlanDialog"

export function AddToMealPlanButton({ recipe }: { recipe: RecipeOutput }) {
  const user = useCurrentUser()
  const [open, setOpen] = useState(false)
  if (!recipe.id || !user || user.isAnonymous) return null
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-11 rounded-full bg-gray-800 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700"
      >
        Add to meal plan
      </button>
      {open && (
        <MealPlanDialog
          date={todayIsoDateString()}
          recipe={{ id: recipe.id, name: recipe.name }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

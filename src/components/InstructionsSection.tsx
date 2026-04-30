import type { RecipeStep } from "../api/generated/types.gen"
import { useCookMode } from "../contexts/CookModeContext"
import { CookModeToggle } from "./CookModeToggle"
import { InstructionStep } from "./InstructionStep"

export function InstructionsSection({
  steps,
  recipeId,
}: {
  steps: RecipeStep[]
  recipeId: string
}) {
  const { isCookMode } = useCookMode()
  return (
    <section className="rounded-lg bg-gray-900 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className={`font-semibold text-gray-100 ${isCookMode ? "text-lg" : "text-xl"}`}>
          Instructions
        </h2>
        <CookModeToggle />
      </div>
      <ol className={`space-y-3 ${isCookMode ? "cook-mode-text" : ""}`}>
        {steps.map((step, i) => (
          <InstructionStep
            key={step.id ?? step.text ?? i}
            step={step}
            index={i}
            recipeId={recipeId}
          />
        ))}
      </ol>
    </section>
  )
}

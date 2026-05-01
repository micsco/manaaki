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

  const className = isCookMode ? "overflow-y-auto px-4 py-6 lg:pl-10" : "pl-0 md:pl-10"

  return (
    <section className={className}>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-sans font-semibold text-gray-500 text-xs uppercase tracking-widest">
          Method
        </h2>
        {!isCookMode && <CookModeToggle />}
      </div>
      <ol className="space-y-3">
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

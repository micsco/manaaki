import { CirclePlay } from "lucide-react"
import type { RecipeStep } from "../api/generated/types.gen"
import { useCookMode } from "../contexts/CookModeContext"
import { InstructionStep } from "./InstructionStep"
import { Button } from "./ui"

export function InstructionsSection({
  steps,
  recipeId,
  onStartStepByStep,
}: {
  steps: RecipeStep[]
  recipeId: string
  onStartStepByStep: () => void
}) {
  const { isCookMode } = useCookMode()
  return (
    <section className="rounded-lg bg-gray-900 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className={`font-semibold text-gray-100 ${isCookMode ? "text-lg" : "text-xl"}`}>
          Instructions
        </h2>
        {!isCookMode && (
          <Button onClick={onStartStepByStep} size="sm" className="bg-green-600 hover:bg-green-700">
            <CirclePlay className="h-4 w-4" aria-hidden="true" />
            Step-by-Step
          </Button>
        )}
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

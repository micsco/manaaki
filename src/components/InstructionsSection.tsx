import type { RecipeStep } from "../api/generated/types.gen"
import { useCookMode } from "../contexts/CookModeContext"
import { CookModeToggle } from "./CookModeToggle"
import { InstructionSectionHeader } from "./InstructionSectionHeader"
import { InstructionStep } from "./InstructionStep"

interface StepGroup {
  title: string | null
  steps: { step: RecipeStep; index: number }[]
}

function groupSteps(steps: RecipeStep[]): StepGroup[] {
  const groups: StepGroup[] = []
  let current: StepGroup = { title: null, steps: [] }

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    if (step.title?.trim()) {
      if (current.steps.length > 0 || current.title !== null) {
        groups.push(current)
      }
      current = { title: step.title.trim(), steps: [{ step, index: i }] }
    } else {
      current.steps.push({ step, index: i })
    }
  }
  if (current.steps.length > 0 || current.title !== null) {
    groups.push(current)
  }

  return groups
}

export function InstructionsSection({
  steps,
  recipeId,
}: {
  steps: RecipeStep[]
  recipeId: string
}) {
  const { isCookMode } = useCookMode()
  const groups = groupSteps(steps)
  const hasSections = groups.some(g => g.title !== null)

  const className = isCookMode ? "overflow-y-auto px-4 py-6 lg:pl-10" : "pl-0 md:pl-10"

  return (
    <section className={className}>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-sans font-semibold text-gray-500 text-xs uppercase tracking-widest">
          Method
        </h2>
        {!isCookMode && <CookModeToggle />}
      </div>
      <ol className="space-y-0.5">
        {hasSections
          ? groups.map((group, gi) => (
              <li key={group.title ?? `group-${gi}`} className="list-none space-y-0.5">
                {group.title && (
                  <InstructionSectionHeader
                    title={group.title}
                    recipeId={recipeId}
                    indices={group.steps.map(s => s.index)}
                  />
                )}
                {group.steps.map(({ step, index }) => (
                  <InstructionStep
                    key={step.id ?? step.text ?? index}
                    step={step}
                    index={index}
                    recipeId={recipeId}
                  />
                ))}
              </li>
            ))
          : steps.map((step, i) => (
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

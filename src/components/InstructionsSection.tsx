import { mdiChevronDown, mdiChevronUp } from "@mdi/js"
import { useState } from "react"
import type { RecipeStep } from "../api/generated/types.gen"
import { useCookMode } from "../contexts/CookModeContext"
import { CookModeToggle } from "./CookModeToggle"
import { Icon } from "./Icon"
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
  img,
}: {
  steps: RecipeStep[]
  recipeId: string
  img?: string | null
}) {
  const { isCookMode } = useCookMode()
  const [photoOpen, setPhotoOpen] = useState(false)
  const groups = groupSteps(steps)
  const hasSections = groups.some(g => g.title !== null)

  if (isCookMode) {
    return (
      <section className="overflow-y-auto px-4 py-6 lg:pl-10">
        {img && photoOpen && (
          <img
            src={img}
            alt=""
            className="mb-4 w-full"
            style={{ maxHeight: "90vh", objectFit: "contain" }}
            draggable={false}
          />
        )}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-sans font-semibold text-gray-500 text-xs uppercase tracking-widest">
            Method
          </h2>
          {img && (
            <button
              type="button"
              aria-label={photoOpen ? "Hide photo" : "Show photo"}
              onClick={() => setPhotoOpen(prev => !prev)}
              className="flex select-none items-center gap-1 text-gray-400 text-xs hover:text-gray-300"
            >
              <Icon path={photoOpen ? mdiChevronUp : mdiChevronDown} size={0.55} aria-hidden />
              {photoOpen ? "Hide photo" : "Photo"}
            </button>
          )}
        </div>
        {hasSections ? (
          <div>
            {groups.map((group, gi) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: group index is stable; groups are derived from recipe steps with no stable ID
              <section key={`${recipeId}-group-${gi}`}>
                {group.title && (
                  <InstructionSectionHeader
                    title={group.title}
                    recipeId={recipeId}
                    indices={group.steps.map(s => s.index)}
                  />
                )}
                <ol>
                  {group.steps.map(({ step, index }) => (
                    <InstructionStep
                      key={step.id ?? `${recipeId}-${index}`}
                      step={step}
                      index={index}
                      recipeId={recipeId}
                    />
                  ))}
                </ol>
              </section>
            ))}
          </div>
        ) : (
          <ol>
            {steps.map((step, i) => (
              <InstructionStep
                key={step.id ?? `${recipeId}-${i}`}
                step={step}
                index={i}
                recipeId={recipeId}
              />
            ))}
          </ol>
        )}
      </section>
    )
  }

  return (
    <section className="pl-0 md:pl-10">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-sans font-semibold text-gray-500 text-xs uppercase tracking-widest">
          Method
        </h2>
        <CookModeToggle />
      </div>
      {hasSections ? (
        <div>
          {groups.map((group, gi) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: group index is stable; groups are derived from recipe steps with no stable ID
            <section key={`${recipeId}-group-${gi}`}>
              {group.title && (
                <InstructionSectionHeader
                  title={group.title}
                  recipeId={recipeId}
                  indices={group.steps.map(s => s.index)}
                />
              )}
              <ol>
                {group.steps.map(({ step, index }) => (
                  <InstructionStep
                    key={step.id ?? `${recipeId}-${index}`}
                    step={step}
                    index={index}
                    recipeId={recipeId}
                  />
                ))}
              </ol>
            </section>
          ))}
        </div>
      ) : (
        <ol>
          {steps.map((step, i) => (
            <InstructionStep
              key={step.id ?? `${recipeId}-${i}`}
              step={step}
              index={i}
              recipeId={recipeId}
            />
          ))}
        </ol>
      )}
    </section>
  )
}

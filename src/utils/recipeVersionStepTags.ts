import type { StepTag } from "./recipeVersionDraft"

export type StepPlan = { tag: StepTag; written: string }

export type PlanRow = { step: number; parts: string[]; alongsidePrevious: boolean }

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours} h ${rest} min` : `${hours} h`
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function stepTagParts(tag: StepTag): string[] {
  const parts = [
    tag.zone,
    tag.function,
    tag.setting,
    tag.minutes === null ? null : formatMinutes(tag.minutes),
  ].flatMap(part => (part?.trim() ? [capitalise(part.trim())] : []))
  return parts.filter(
    (part, index) => parts.findIndex(other => other.toLowerCase() === part.toLowerCase()) === index
  )
}

function mentionsMinutes(text: string, minutes: number): boolean {
  const numbers = [...text.matchAll(/\d+/g)].map(match => Number(match[0]))
  return numbers.includes(minutes) || (minutes % 60 === 0 && numbers.includes(minutes / 60))
}

export function visibleTag(plan: StepPlan | null | undefined, text: string): StepTag | null {
  if (!plan) return null
  if (text === plan.written || plan.tag.minutes === null) return plan.tag
  return mentionsMinutes(text, plan.tag.minutes) ? plan.tag : null
}

export function initialStepPlans(steps: string[], tags: StepTag[]): (StepPlan | null)[] {
  if (tags.length !== steps.length) return steps.map(() => null)
  return steps.map((written, index) => ({ tag: tags[index], written }))
}

export function cookingPlan(steps: string[], plans: (StepPlan | null)[]): PlanRow[] {
  return steps.flatMap((text, index) => {
    const tag = visibleTag(plans[index], text)
    return tag && tag.minutes !== null
      ? [{ step: index + 1, parts: stepTagParts(tag), alongsidePrevious: tag.alongsidePrevious }]
      : []
  })
}

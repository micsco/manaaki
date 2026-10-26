import { z } from "zod"

import { findFunction, type HouseholdAppliance } from "../utils/householdAppliances"
import type { RecipeVersionDraft, StepTag } from "../utils/recipeVersionDraft"
import { planCookMinutes, validatePlan } from "../utils/recipeVersionPlan"
import { draftSchema } from "./recipeVersionSchema"

export const taggedStepSchema = z.object({
  text: z.string().min(1).max(2000),
  zone: z.string().nullable(),
  function: z.string().nullable(),
  setting: z.string().nullable(),
  minutes: z.number().int().nullable(),
  alongsidePrevious: z.boolean(),
})

export type TaggedStep = z.infer<typeof taggedStepSchema>

export const structuredDraftSchema = draftSchema
  .omit({ steps: true, cookMinutes: true, totalMinutes: true })
  .extend({ steps: z.array(taggedStepSchema).min(1).max(40), waitingMinutes: z.number().int() })

export type StructuredDraft = z.infer<typeof structuredDraftSchema>

export const STRUCTURED_RULES = `
Steps are tagged so code can check them:
- Each step has its text plus tags: zone (Zone 1, Zone 2, pot, hob, oven, or null), function as the appliance names it (or Hob, Oven or Rest for anything outside it), setting (°C, LO or HI, or null), minutes the step spends on heat or in the appliance (null for hands-on work with no cooking time), and alongsidePrevious (true if it runs at the same time as the previous timed step, such as the other air fryer zone under SYNC).
- The step text must state the same function, setting and time as its tags.
- Cook and total times are calculated from your tags, so tag every timed step. prepMinutes is hands-on work; waitingMinutes is marinating, chilling or resting (describe it in waitingNote).`

export function timedStages(steps: TaggedStep[]) {
  return steps.flatMap(step =>
    step.minutes === null
      ? []
      : [
          {
            zone: step.zone,
            function: step.function ?? "",
            setting: step.setting,
            minutes: step.minutes,
            alongsidePrevious: step.alongsidePrevious,
            what: step.text,
          },
        ]
  )
}

export function toDraft(structured: StructuredDraft): RecipeVersionDraft {
  const cookMinutes = planCookMinutes(timedStages(structured.steps))
  const { steps, waitingMinutes, ...rest } = structured
  return {
    ...rest,
    steps: steps.map(step => step.text),
    cookMinutes,
    totalMinutes: structured.prepMinutes + cookMinutes + waitingMinutes,
  }
}

export function stepTagsOf(structured: StructuredDraft): StepTag[] {
  return structured.steps.map(({ text: _text, ...tag }) => tag)
}

export type Finding = { step: number | null; message: string }

const DURATION =
  /(\d+(?:[.,]\d+)?)\s*(?:(?:–|-|to)\s*(\d+(?:[.,]\d+)?)\s*)?(hours?|hrs?|h|minutes?|mins?)\b(?:\s*(?:and\s*)?(\d+)\s*(?:minutes?|mins?))?/gi

export function durationsInText(text: string): [number, number][] {
  return [...text.replaceAll("½", ".5").matchAll(DURATION)].map(match => {
    const unit = match[3].toLowerCase().startsWith("h") ? 60 : 1
    const extra = Number(match[4] ?? 0)
    const low = Number(match[1].replace(",", ".")) * unit + extra
    const high = match[2] ? Number(match[2].replace(",", ".")) * unit + extra : low
    return [low, high]
  })
}

function mentionsSetting(text: string, setting: string): boolean {
  const lower = text.toLowerCase()
  const level = setting.trim().toLowerCase()
  if (level === "lo" || level === "low") return /\b(lo|low)\b/.test(lower)
  if (level === "hi" || level === "high") return /\b(hi|high)\b/.test(lower)
  const degrees = /(\d{2,3})/.exec(setting)?.[1]
  return degrees ? lower.includes(degrees) : true
}

export function tagFindings(steps: TaggedStep[], appliance: HouseholdAppliance | null): Finding[] {
  return steps.flatMap((step, index) => {
    const number = index + 1
    const findings: Finding[] = []
    if (step.minutes !== null && step.function) {
      for (const problem of validatePlan(
        [{ ...timedStages([step])[0], alongsidePrevious: false }],
        appliance
      )) {
        findings.push({ step: number, message: `Step ${number}: ${problem}` })
      }
      const durations = durationsInText(step.text)
      const known = appliance ? findFunction(appliance, step.function) : null
      if (
        durations.length &&
        !durations.some(([low, high]) => step.minutes! >= low - 1 && step.minutes! <= high + 1)
      ) {
        findings.push({
          step: number,
          message: `Step ${number} is tagged ${step.minutes} min, but the text gives a different time.`,
        })
      }
      if (known && step.setting && !mentionsSetting(step.text, step.setting)) {
        findings.push({
          step: number,
          message: `Step ${number} is tagged ${step.setting}, but the text doesn't say so.`,
        })
      }
    }
    return findings
  })
}

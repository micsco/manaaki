import { COOKING_METHOD_LABELS, type CookingMethod } from "./recipeVersions"

export type IngredientChange = {
  index: number
  quantity: number | null
  remove: boolean
  reason: string
}

export type NewIngredient = { text: string; reason: string }

export type DraftNote = { title: string; text: string }

export type RecipeVersionDraft = {
  name: string
  description: string
  prepMinutes: number
  cookMinutes: number
  totalMinutes: number
  waitingNote: string | null
  steps: string[]
  notes: DraftNote[]
  ingredientChanges: IngredientChange[]
  newIngredients: NewIngredient[]
  assumptions: string[]
  confidence: "high" | "medium" | "low"
}

export type SourceIngredient = { text: string; quantity: number | null }

export type DraftSource = {
  name: string
  method: CookingMethod
  ingredients: SourceIngredient[]
  steps: string[]
}

export type CheckLevel = "block" | "warn"

export type DraftCheck = { id: string; level: CheckLevel; message: string }

const COOK_RANGES: Record<CookingMethod, [number, number]> = {
  airFryer: [5, 90],
  oven: [5, 300],
  slowCooker: [90, 720],
}

const TEMPERATURE_RANGES: Partial<Record<CookingMethod, [number, number]>> = {
  airFryer: [120, 210],
  oven: [100, 260],
}

const APPLIANCE_WORDS: Record<CookingMethod, RegExp> = {
  airFryer: /\bair[- ]?fr(y|ier|yer)/i,
  oven: /\boven\b/i,
  slowCooker: /\b(slow[- ]?cook(er)?|crock[- ]?pot|possiblecooker)\b/i,
}

const SOURCE_SETUP: Record<CookingMethod, RegExp> = {
  airFryer: /\b(preheat|heat)\b[^.]{0,30}\bair[- ]?fryer\b|\bair[- ]?fryer basket\b/i,
  oven: /\bpreheat\b[^.]{0,20}\boven\b|\bbaking (sheet|tray)\b|\bfan oven\b/i,
  slowCooker: /\bslow[- ]?cooker\b/i,
}

const DONENESS =
  /\b(cooked through|no longer pink|juices run clear|internal temperature|core temperature|\d{2,3}\s*°?\s*[CF]\s*(inside|internal))/i

const MARKUP = /<\/?[a-z][^>]*>|javascript:|\bdata:[a-z]+\//i

const CELSIUS = /(\d{2,3})\s*°\s*C\b|(\d{2,3})\s*(?:degrees\s*)?C(?:elsius)?\b/gi
const FAHRENHEIT = /\d{2,3}\s*°\s*F\b|\d{2,3}\s*degrees\s*F/i

function draftText(draft: RecipeVersionDraft): string {
  return [
    draft.name,
    draft.description,
    ...draft.steps,
    ...draft.notes.map(n => `${n.title} ${n.text}`),
    ...draft.newIngredients.map(i => i.text),
  ].join("\n")
}

export function methodLabel(method: CookingMethod): string {
  return COOKING_METHOD_LABELS[method]
}

export function checkDraft(
  draft: RecipeVersionDraft,
  source: DraftSource,
  target: CookingMethod,
  existingNames: string[] = []
): DraftCheck[] {
  const checks: DraftCheck[] = []
  const block = (id: string, message: string) => checks.push({ id, level: "block", message })
  const warn = (id: string, message: string) => checks.push({ id, level: "warn", message })

  if (!draft.name.trim()) block("name-missing", "The new version needs a name.")
  if (draft.steps.filter(step => step.trim()).length === 0)
    block("steps-missing", "The method has no steps.")

  const seen = new Set<number>()
  for (const change of draft.ingredientChanges) {
    if (
      !Number.isInteger(change.index) ||
      change.index < 0 ||
      change.index >= source.ingredients.length
    ) {
      block(
        "ingredient-unknown",
        `An ingredient change points at a line that doesn't exist (line ${change.index + 1}).`
      )
      continue
    }
    if (seen.has(change.index))
      block("ingredient-duplicate", `Line ${change.index + 1} is changed more than once.`)
    seen.add(change.index)
    const line = source.ingredients[change.index]
    if (!change.reason.trim())
      block("ingredient-reason", `The change to "${line.text}" has no reason.`)
    if (change.remove) continue
    if (change.quantity !== null && (!Number.isFinite(change.quantity) || change.quantity <= 0)) {
      block("ingredient-quantity", `The new amount for "${line.text}" isn't a valid number.`)
    } else if (change.quantity !== null && line.quantity === null) {
      block(
        "ingredient-unparsed",
        `"${line.text}" has no separate amount, so it can't be changed. Untick it or parse the ingredients first.`
      )
    } else if (change.quantity !== null && line.quantity) {
      const ratio = change.quantity / line.quantity
      if (ratio < 0.25 || ratio > 2) {
        warn(
          "ingredient-ratio",
          `"${line.text}" changes from ${line.quantity} to ${change.quantity}, a big jump.`
        )
      }
    }
  }
  for (const added of draft.newIngredients) {
    if (!added.text.trim()) block("ingredient-new-empty", "A new ingredient has no text.")
    else if (!added.reason.trim())
      block("ingredient-new-reason", `The new ingredient "${added.text}" has no reason.`)
  }

  const times = [draft.prepMinutes, draft.cookMinutes, draft.totalMinutes]
  if (times.some(t => !Number.isFinite(t) || t < 0)) {
    block("times-invalid", "Prep, cook and total times must be zero or more minutes.")
  } else {
    if (draft.totalMinutes <= 0) block("total-missing", "The total time is missing.")
    if (draft.totalMinutes < Math.max(draft.prepMinutes, draft.cookMinutes)) {
      block("total-short", "The total time is shorter than the prep or cook time.")
    }
    const [low, high] = COOK_RANGES[target]
    if (draft.cookMinutes < low || draft.cookMinutes > high) {
      warn(
        "cook-range",
        `A ${draft.cookMinutes} min cook is unusual for a ${methodLabel(target).toLowerCase()} (${low}–${high} min).`
      )
    }
  }

  const text = draftText(draft)
  if (MARKUP.test(text))
    block("markup", "The draft contains HTML or a script link. Remove it before saving.")

  const range = TEMPERATURE_RANGES[target]
  if (FAHRENHEIT.test(text)) warn("fahrenheit", "The method uses Fahrenheit; use °C.")
  if (range) {
    for (const match of text.matchAll(CELSIUS)) {
      const value = Number(match[1] ?? match[2])
      if (value < range[0] || value > range[1]) {
        warn(
          "temperature-range",
          `${value}°C is outside the usual ${methodLabel(target).toLowerCase()} range (${range[0]}–${range[1]}°C).`
        )
      }
    }
  }
  if (target === "slowCooker" && !/\b(low|high|hi)\b/i.test(draft.steps.join(" "))) {
    warn("slow-cooker-setting", "The method doesn't say whether to use the Low or Hi setting.")
  }

  const steps = draft.steps.join("\n")
  if (!APPLIANCE_WORDS[target].test(steps)) {
    warn("target-missing", `The method never mentions the ${methodLabel(target).toLowerCase()}.`)
  }
  if (source.method !== target && SOURCE_SETUP[source.method].test(steps)) {
    warn(
      "source-leftover",
      `The method still mentions the ${methodLabel(source.method).toLowerCase()}.`
    )
  }
  if (DONENESS.test(source.steps.join("\n")) && !DONENESS.test(steps)) {
    warn(
      "doneness-dropped",
      "The original says how to tell it's cooked through; the new method doesn't."
    )
  }

  const original = source.steps.length
  const count = draft.steps.length
  if (original > 0 && (count < original * 0.5 || count > original * 2)) {
    warn("step-count", `The method goes from ${original} to ${count} steps.`)
  }

  const label = methodLabel(target)
  if (!draft.name.toLowerCase().includes(label.toLowerCase())) {
    warn("name-label", `The name doesn't say it's the ${label.toLowerCase()} version.`)
  }
  if (existingNames.some(name => name.trim().toLowerCase() === draft.name.trim().toLowerCase())) {
    warn("name-taken", "A recipe with this name already exists.")
  }
  if (draft.confidence === "low")
    warn("low-confidence", "The AI wasn't confident about this draft.")

  return checks
}

export function blockingChecks(checks: DraftCheck[]): DraftCheck[] {
  return checks.filter(check => check.level === "block")
}

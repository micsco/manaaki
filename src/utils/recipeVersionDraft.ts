import { findFunction, householdAppliance } from "./householdAppliances"
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
  airFryer: [120, 240],
  oven: [100, 260],
}

const APPLIANCE_WORDS: Record<CookingMethod, RegExp> = {
  airFryer: /\bair[- ]?fr(y|ier|yer)|\bzone [12]\b|\bdrawers?\b|\bcrisper plates?\b/i,
  oven: /\boven\b/i,
  slowCooker: /\b(slow[- ]?cook(er)?|crock[- ]?pot|possiblecooker|braise)\b|\bsear\/saut/i,
}

const SOURCE_SETUP: Record<CookingMethod, RegExp> = {
  airFryer: /\b(preheat|heat)\b[^.]{0,30}\bair[- ]?fryer\b|\bair[- ]?fryer basket\b/i,
  oven: /\bpreheat\b[^.]{0,20}\boven\b|\bbaking (sheet|tray)\b|\bfan oven\b/i,
  slowCooker: /\bslow[- ]?cooker\b/i,
}

const DONENESS =
  /\b(cooked through|no longer pink|juices run clear|internal temperature|core temperature|flakes?( easily)?|opaque|\d{2,3}\s*°?\s*[CF]\s*(inside|internal))|\b[5-9]\d\s*°\s*C\b/i

const FOOD_TEMPERATURE =
  /\b(internal|core|centre|center|thermometer|reach(es|ed)?|safe)\b(\W+\w+){0,3}\W*$/i

const FOOD_TEMPERATURE_AFTER =
  /^\W{0,3}(internal(ly)?|inside|core|at the (centre|center|core)|in the (centre|center|middle|thickest))/i

const MARKUP = /<\/?[a-z][^>]*>|javascript:|\bdata:[a-z]+\//i

const CELSIUS = /(\d{2,3})\s*°\s*C\b|(\d{2,3})\s*(?:degrees\s*)?C(?:elsius)?\b/gi
const CELSIUS_WITH_FAHRENHEIT = /\d{2,3}\s*°\s*C\s*\(\s*\d{2,3}\s*°\s*F\s*\)/gi

const FOOD_ONLY_BELOW = 100
const LOW_HEAT_FUNCTION = /\b(dehydrat\w*|prove|proving|keep warm)\b/i

function sentenceAround(text: string, index: number): string {
  const start = Math.max(text.lastIndexOf(".", index), text.lastIndexOf("\n", index)) + 1
  const ends = [text.indexOf(".", index), text.indexOf("\n", index)].filter(end => end !== -1)
  return text.slice(start, ends.length ? Math.min(...ends) : text.length)
}

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

const SLOW_COOK_SETTING =
  /\b(LO|LOW|HI|HIGH)\b[^.\n]{0,25}?\bfor\s+(?:(\d+(?:[.,]\d+)?)?\s*(½|¼|¾)?\s*(hours?|hrs?|h)\b(?:\s*(?:and\s*)?(\d+)\s*(?:minutes?|mins?))?|(\d+)\s*(?:minutes?|mins?))/gi

const FRACTIONS: Record<string, number> = { "½": 0.5, "¼": 0.25, "¾": 0.75 }

export function slowCookSettings(text: string): { level: "lo" | "hi"; minutes: number }[] {
  return text
    .split(/[.!?]\s+|\n/)
    .filter(sentence => /slow[- ]?cook/i.test(sentence))
    .flatMap(sentence =>
      [...sentence.matchAll(SLOW_COOK_SETTING)].flatMap(match => {
        const [, level, whole, fraction, hourUnit, extraMinutes, onlyMinutes] = match
        const minutes = onlyMinutes
          ? Number(onlyMinutes)
          : hourUnit && (whole || fraction)
            ? (Number((whole ?? "0").replace(",", ".")) + (fraction ? FRACTIONS[fraction] : 0)) *
                60 +
              Number(extraMinutes ?? 0)
            : null
        if (minutes === null) return []
        return [
          {
            level: level.toLowerCase().startsWith("l") ? ("lo" as const) : ("hi" as const),
            minutes,
          },
        ]
      })
    )
}

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = Math.round(minutes % 60)
  if (!hours) return `${rest} min`
  return rest ? `${hours} h ${rest} min` : `${hours} h`
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
  if (FAHRENHEIT.test(text.replace(CELSIUS_WITH_FAHRENHEIT, "")))
    warn("fahrenheit", "The method uses Fahrenheit; use °C.")
  if (range) {
    for (const match of text.matchAll(CELSIUS)) {
      const start = match.index ?? 0
      const before = text.slice(Math.max(0, start - 60), start)
      const after = text.slice(start + match[0].length, start + match[0].length + 40)
      if (FOOD_TEMPERATURE.test(before) || FOOD_TEMPERATURE_AFTER.test(after)) continue
      const value = Number(match[1] ?? match[2])
      if (value < FOOD_ONLY_BELOW && !LOW_HEAT_FUNCTION.test(sentenceAround(text, start))) continue
      if (value < range[0] || value > range[1]) {
        warn(
          "temperature-range",
          `${value}°C is outside the usual ${methodLabel(target).toLowerCase()} range (${range[0]}–${range[1]}°C).`
        )
      }
    }
  }
  const appliance = householdAppliance(target)
  const limits = appliance ? findFunction(appliance, "Slow Cook")?.settings : null
  if (limits) {
    for (const setting of slowCookSettings(draft.steps.join("\n"))) {
      const range = limits[setting.level]
      if (range && (setting.minutes < range.minMinutes || setting.minutes > range.maxMinutes)) {
        block(
          "slow-cook-limits",
          `Slow Cook ${setting.level.toUpperCase()} for ${formatMinutes(setting.minutes)} isn't possible on this slow cooker (${formatMinutes(range.minMinutes)}–${formatMinutes(range.maxMinutes)}).`
        )
      }
    }
  }
  if (target === "slowCooker" && !/\b(low|high|lo|hi|braise)\b/i.test(draft.steps.join(" "))) {
    warn(
      "slow-cooker-setting",
      "The method doesn't say whether to use the LO or HI setting (or Braise)."
    )
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

export type DraftMetrics = {
  model: string
  escalationModel: string | null
  calls: number
  initialProblems: number
  repairRan: boolean
  repairFixed: boolean
  escalated: boolean
  escalationFixed: boolean
  thinkingLevel: string
  promptVersion: string
  firstChunkMs: number | null
  inputTokens: number
  outputTokens: number
  thinkingTokens: number | null
  mealieMs: number
  firstTokenMs: number | null
  modelMs: number
  checksMs: number
  totalMs: number
}

export type DraftProgressEvent =
  | { type: "progress"; stage: "thinking"; thought?: string }
  | { type: "progress"; stage: "checking" }
  | { type: "progress"; stage: "writing"; steps: number }
  | { type: "progress"; stage: "fixing"; problems: number; escalated: boolean }

export type DraftStreamEvent =
  | DraftProgressEvent
  | {
      type: "result"
      draft: RecipeVersionDraft
      checks: DraftCheck[]
      source: DraftSource
      metrics: DraftMetrics
    }
  | { type: "error"; status: number; error: string }

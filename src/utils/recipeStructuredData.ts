import type {
  Nutrition,
  RecipeOutput,
  RecipeSettings,
  RecipeStep,
} from "../api/generated/types.gen"
import {
  formatIngredientLine,
  groupByTitle,
  recipeCookMinutes,
  recipeHandsOnMinutes,
  recipeImageUrl,
  recipeTotalMinutes,
  recipeUrl,
  safeExternalUrl,
} from "./recipe"

export type JsonLdValue = string | number | boolean | null | JsonLdObject | JsonLdValue[]
export type JsonLdObject = { [key: string]: JsonLdValue }

function formatIsoDuration(minutes: number | null): string | null {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return null
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  if (hours && remainder) return `PT${hours}H${remainder}M`
  if (hours) return `PT${hours}H`
  return `PT${remainder}M`
}

function parseNumber(value: string | null | undefined, allowZero = false): number | null {
  if (!value) return null
  const parsed = Number.parseFloat(value)
  if (!Number.isFinite(parsed)) return null
  if (!allowZero && parsed <= 0) return null
  return parsed
}

function formatGramOrMg(value: string | null | undefined, unit: "g" | "mg"): string | null {
  const num = parseNumber(value)
  if (num === null) return null
  const formatted = Number.isInteger(num) ? String(num) : num.toFixed(1)
  return `${formatted} ${unit}`
}

function buildNutritionJsonLd(
  nutrition: Nutrition | null | undefined,
  settings: RecipeSettings | null | undefined
): JsonLdObject | null {
  if (!settings?.showNutrition || !nutrition) return null

  const result: JsonLdObject = { "@type": "NutritionInformation" }

  const calories = parseNumber(nutrition.calories)
  if (calories !== null) result.calories = `${Math.round(calories)} calories`

  const mappings: [string, string | null][] = [
    ["proteinContent", formatGramOrMg(nutrition.proteinContent, "g")],
    ["carbohydrateContent", formatGramOrMg(nutrition.carbohydrateContent, "g")],
    ["fatContent", formatGramOrMg(nutrition.fatContent, "g")],
    ["saturatedFatContent", formatGramOrMg(nutrition.saturatedFatContent, "g")],
    ["fiberContent", formatGramOrMg(nutrition.fiberContent, "g")],
    ["sugarContent", formatGramOrMg(nutrition.sugarContent, "g")],
    ["sodiumContent", formatGramOrMg(nutrition.sodiumContent, "mg")],
  ]

  for (const [key, formatted] of mappings) {
    if (formatted) result[key] = formatted
  }

  return Object.keys(result).length > 1 ? result : null
}

function buildRecipeYield(recipe: RecipeOutput): string | null {
  const yieldText = recipe.recipeYield?.trim()
  if (recipe.recipeServings != null && recipe.recipeServings > 0) {
    return yieldText ? `${recipe.recipeServings} ${yieldText}` : `${recipe.recipeServings} servings`
  }
  return yieldText || null
}

function toHowToStep(step: RecipeStep): JsonLdObject | null {
  const text = step.text?.trim()
  if (!text) return null
  const entry: JsonLdObject = { "@type": "HowToStep", text }
  const summary = step.summary?.trim()
  if (summary) entry.name = summary
  return entry
}

function buildInstructionsJsonLd(steps: RecipeStep[] | null | undefined): JsonLdObject[] {
  if (!steps?.length) return []
  const groups = groupByTitle(steps, step => !step.text?.trim())
  const hasSections = groups.some(group => group.title !== null)

  if (!hasSections) {
    return steps.map(toHowToStep).filter((entry): entry is JsonLdObject => entry !== null)
  }

  const output: JsonLdObject[] = []
  for (const group of groups) {
    const items = group.items
      .map(({ item }) => toHowToStep(item))
      .filter((entry): entry is JsonLdObject => entry !== null)
    if (items.length === 0) continue

    if (group.title) {
      output.push({
        "@type": "HowToSection",
        name: group.title,
        itemListElement: items,
      })
    } else {
      output.push(...items)
    }
  }
  return output
}

function toAbsoluteUrl(origin: string, path: string | null | undefined): string | null {
  if (!path) return null
  if (path.startsWith("http://") || path.startsWith("https://")) return path
  const normalizedOrigin = origin.replace(/\/+$/, "")
  return `${normalizedOrigin}${path.startsWith("/") ? path : `/${path}`}`
}

export function buildRecipeJsonLd(recipe: RecipeOutput, origin: string): JsonLdObject {
  const jsonLd: JsonLdObject = {
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: recipe.name?.trim() || "Recipe",
  }

  if (recipe.id && recipe.slug) {
    const url = toAbsoluteUrl(origin, recipeUrl(recipe.id, recipe.slug))
    if (url) jsonLd.url = url
  }

  const description = recipe.description?.trim()
  if (description) jsonLd.description = description

  if (recipe.id && recipe.image) {
    const image = toAbsoluteUrl(origin, recipeImageUrl(recipe.id, "original", recipe.image))
    if (image) jsonLd.image = [image]
  }

  const datePublished = recipe.dateAdded || recipe.createdAt
  if (datePublished) jsonLd.datePublished = datePublished

  const dateModified = recipe.dateUpdated || recipe.updatedAt
  if (dateModified) jsonLd.dateModified = dateModified

  const prepTime = formatIsoDuration(recipeHandsOnMinutes(recipe))
  if (prepTime) jsonLd.prepTime = prepTime

  const cookTime = formatIsoDuration(recipeCookMinutes(recipe))
  if (cookTime) jsonLd.cookTime = cookTime

  const totalTime = formatIsoDuration(recipeTotalMinutes(recipe))
  if (totalTime) jsonLd.totalTime = totalTime

  const recipeYield = buildRecipeYield(recipe)
  if (recipeYield) jsonLd.recipeYield = recipeYield

  const categories = (recipe.recipeCategory ?? [])
    .map(category => category.name?.trim())
    .filter((name): name is string => Boolean(name))
  if (categories.length === 1) jsonLd.recipeCategory = categories[0]
  else if (categories.length > 1) jsonLd.recipeCategory = categories

  const tags = [
    ...new Set(
      (recipe.tags ?? [])
        .map(tag => tag.name?.trim())
        .filter((name): name is string => Boolean(name))
    ),
  ]
  if (tags.length > 0) jsonLd.keywords = tags.join(", ")

  const ingredients = (recipe.recipeIngredient ?? [])
    .map(ingredient => formatIngredientLine(ingredient))
    .filter(Boolean)
  if (ingredients.length > 0) jsonLd.recipeIngredient = ingredients

  const instructions = buildInstructionsJsonLd(recipe.recipeInstructions)
  if (instructions.length > 0) jsonLd.recipeInstructions = instructions

  const nutrition = buildNutritionJsonLd(recipe.nutrition, recipe.settings)
  if (nutrition) jsonLd.nutrition = nutrition

  const sourceUrl = safeExternalUrl(recipe.orgURL)
  if (sourceUrl) jsonLd.isBasedOn = sourceUrl

  return jsonLd
}

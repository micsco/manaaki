import type {
  Nutrition,
  RecipeOutput,
  RecipeSettings,
  RecipeSummary,
} from "../api/generated/types.gen"
import {
  formatIngredientLine,
  groupByTitle,
  isHeadingOnlyIngredient,
  recipeTimes,
  recipeUrl,
  recipeWaitingNote,
  safeExternalUrl,
} from "./recipe"

const MAX_LLMS_DESCRIPTION_LENGTH = 160

function normalizeOrigin(origin: string): string {
  return origin.replace(/\/+$/, "")
}

function parseStat(value: string | null | undefined): string | null {
  if (!value || value === "0" || value === "0.0") return null
  const num = Number.parseFloat(value)
  if (!Number.isFinite(num) || num <= 0) return null
  return Number.isInteger(num) ? String(num) : num.toFixed(1)
}

function parseCalories(value: string | null | undefined): string | null {
  if (!value) return null
  const num = Number.parseFloat(value)
  if (!Number.isFinite(num) || num <= 0) return null
  return String(Math.round(num))
}

function formatNutritionLines(
  nutrition: Nutrition | null | undefined,
  settings: RecipeSettings | null | undefined
): string[] {
  if (!settings?.showNutrition || !nutrition) return []
  const entries: [string, string | null, string][] = [
    ["Calories", parseCalories(nutrition.calories), "kcal"],
    ["Protein", parseStat(nutrition.proteinContent), "g"],
    ["Carbs", parseStat(nutrition.carbohydrateContent), "g"],
    ["Fat", parseStat(nutrition.fatContent), "g"],
    ["Saturated fat", parseStat(nutrition.saturatedFatContent), "g"],
    ["Fibre", parseStat(nutrition.fiberContent), "g"],
    ["Sugar", parseStat(nutrition.sugarContent), "g"],
    ["Sodium", parseStat(nutrition.sodiumContent), "mg"],
  ]
  return entries
    .filter((entry): entry is [string, string, string] => entry[1] !== null)
    .map(([label, value, unit]) => `- ${label}: ${value} ${unit}`)
}

function formatServings(
  recipe: Pick<RecipeOutput, "recipeServings" | "recipeYield">
): string | null {
  const yieldText = recipe.recipeYield?.trim()
  if (recipe.recipeServings != null && recipe.recipeServings > 0) {
    return yieldText ? `${recipe.recipeServings} ${yieldText}` : String(recipe.recipeServings)
  }
  return yieldText || null
}

function namedList(items: { name?: string | null }[] | null | undefined): string[] {
  return [
    ...new Set(
      (items ?? []).map(item => item.name?.trim()).filter((name): name is string => Boolean(name))
    ),
  ]
}

export function formatRecipeMarkdown(recipe: RecipeOutput, origin: string): string {
  const baseOrigin = normalizeOrigin(origin)
  const sections: string[] = [`# ${recipe.name?.trim() || "Recipe"}`]

  const description = recipe.description?.trim()
  if (description) {
    sections.push(
      description
        .split(/\r?\n/)
        .map(line => `> ${line}`.trimEnd())
        .join("\n")
    )
  }

  const meta: string[] = []
  if (recipe.id && recipe.slug) {
    meta.push(`- **URL**: ${baseOrigin}${recipeUrl(recipe.id, recipe.slug)}`)
  }
  const servings = formatServings(recipe)
  if (servings) meta.push(`- **Servings**: ${servings}`)

  const times = recipeTimes(recipe)
  const waiting = recipeWaitingNote(recipe.extras)
  if (times.prep) meta.push(`- **Prep time**: ${times.prep}`)
  if (times.cook) meta.push(`- **Cook time**: ${times.cook}`)
  if (times.total) {
    meta.push(`- **Total time**: ${waiting ? `${times.total} (incl. ${waiting})` : times.total}`)
  } else if (waiting) {
    meta.push(`- **Waiting time**: ${waiting}`)
  }

  const categories = namedList(recipe.recipeCategory)
  if (categories.length > 0) meta.push(`- **Categories**: ${categories.join(", ")}`)

  const tags = namedList(recipe.tags)
  if (tags.length > 0) meta.push(`- **Tags**: ${tags.join(", ")}`)

  const tools = namedList(recipe.tools)
  if (tools.length > 0) meta.push(`- **Tools**: ${tools.join(", ")}`)

  const sourceUrl = safeExternalUrl(recipe.orgURL)
  if (sourceUrl) meta.push(`- **Source**: ${sourceUrl}`)

  if (meta.length > 0) sections.push(meta.join("\n"))

  const ingredientGroups = groupByTitle(recipe.recipeIngredient ?? [], isHeadingOnlyIngredient)
  const ingredientLines: string[] = []
  for (const group of ingredientGroups) {
    const items = group.items
      .map(({ item }) => formatIngredientLine(item, { includeAlternatives: true }))
      .filter(Boolean)
    if (items.length === 0) continue
    if (group.title) {
      if (ingredientLines.length > 0) ingredientLines.push("")
      ingredientLines.push(`### ${group.title}`, "")
    }
    for (const item of items) ingredientLines.push(`- ${item}`)
  }
  if (ingredientLines.length > 0) {
    sections.push(`## Ingredients\n\n${ingredientLines.join("\n")}`)
  }

  const stepGroups = groupByTitle(recipe.recipeInstructions ?? [], step => !step.text?.trim())
  const instructionLines: string[] = []
  let stepNumber = 1
  for (const group of stepGroups) {
    const items = group.items
      .map(({ item }) => ({
        summary: item.summary?.trim() || "",
        text: item.text?.trim() || "",
      }))
      .filter(item => item.text.length > 0)
    if (items.length === 0) continue
    if (group.title) {
      if (instructionLines.length > 0) instructionLines.push("")
      instructionLines.push(`### ${group.title}`, "")
    }
    for (const item of items) {
      const prefix = item.summary ? `**${item.summary}**: ` : ""
      instructionLines.push(`${stepNumber}. ${prefix}${item.text}`)
      stepNumber++
    }
  }
  if (instructionLines.length > 0) {
    sections.push(`## Instructions\n\n${instructionLines.join("\n")}`)
  }

  const noteBlocks: string[] = []
  for (const note of recipe.notes ?? []) {
    const title = note.title?.trim()
    const text = note.text?.trim()
    if (!title && !text) continue
    if (title && text) noteBlocks.push(`### ${title}\n\n${text}`)
    else if (title) noteBlocks.push(`### ${title}`)
    else if (text) noteBlocks.push(text)
  }
  if (noteBlocks.length > 0) {
    sections.push(`## Notes\n\n${noteBlocks.join("\n\n")}`)
  }

  const nutritionLines = formatNutritionLines(recipe.nutrition, recipe.settings)
  if (nutritionLines.length > 0) {
    sections.push(`## Nutrition (per serving)\n\n${nutritionLines.join("\n")}`)
  }

  return `${sections.join("\n\n")}\n`
}

function escapeLinkLabel(text: string): string {
  return text
    .replace(/[\r\n]+/g, " ")
    .replace(/[[\]]/g, "")
    .trim()
}

function condenseDescription(text: string | null | undefined): string {
  if (!text) return ""
  const collapsed = text.replace(/\s+/g, " ").trim()
  if (collapsed.length <= MAX_LLMS_DESCRIPTION_LENGTH) return collapsed
  return `${collapsed.slice(0, MAX_LLMS_DESCRIPTION_LENGTH - 1).trimEnd()}…`
}

function recipeSummaryBlurbs(recipe: RecipeSummary): string {
  const details: string[] = []
  const total = recipeTimes(recipe).total
  if (total) details.push(total)
  if (recipe.recipeServings != null && recipe.recipeServings > 0) {
    details.push(`Serves ${recipe.recipeServings}`)
  }
  const description = condenseDescription(recipe.description)
  const meta = details.join(" · ")
  if (meta && description) return `${meta} — ${description}`
  return meta || description
}

export function formatLlmsTxt(recipes: RecipeSummary[], origin: string): string {
  const baseOrigin = normalizeOrigin(origin)
  const lines: string[] = [
    "# Manaaki",
    "",
    "> Self-hosted recipe collection powered by Mealie. Every recipe page embeds schema.org/Recipe JSON-LD and is available as clean Markdown via `.md` URLs or `Accept: text/markdown`.",
    "",
    "## Discovery",
    "",
    `- [All recipes](${baseOrigin}/recipes): Browse and filter the recipe collection`,
    `- [Sitemap](${baseOrigin}/sitemap.xml): XML sitemap of all canonical recipe URLs`,
  ]

  const grouped = new Map<string, RecipeSummary[]>()
  for (const recipe of recipes) {
    if (!recipe.id || !recipe.slug) continue
    const category = recipe.recipeCategory?.[0]?.name?.trim() || "Other"
    const bucket = grouped.get(category)
    if (bucket) bucket.push(recipe)
    else grouped.set(category, [recipe])
  }

  const categories = [...grouped.keys()].sort((a, b) => {
    if (a === "Other") return 1
    if (b === "Other") return -1
    return a.localeCompare(b)
  })

  if (categories.length > 0) {
    lines.push("", "## Recipes")
    for (const category of categories) {
      const items = [...(grouped.get(category) ?? [])].sort((a, b) =>
        (a.name ?? "").localeCompare(b.name ?? "")
      )
      lines.push("", `### ${category}`, "")
      for (const recipe of items) {
        if (!recipe.id || !recipe.slug) continue
        const label = escapeLinkLabel(recipe.name?.trim() || recipe.slug)
        const url = `${baseOrigin}${recipeUrl(recipe.id, recipe.slug)}.md`
        const blurb = recipeSummaryBlurbs(recipe)
        lines.push(blurb ? `- [${label}](${url}): ${blurb}` : `- [${label}](${url})`)
      }
    }
  }

  return `${lines.join("\n")}\n`
}

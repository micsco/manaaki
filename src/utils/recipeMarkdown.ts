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
  isoDuration,
  recipeCookMinutes,
  recipeHandsOnMinutes,
  recipeImageUrl,
  recipeTimes,
  recipeTotalMinutes,
  recipeUrl,
  recipeWaitingNote,
} from "./recipe"
import { attributionText, savedRecipeSource } from "./recipeProvenance"

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

type FrontmatterValue = string | number | string[] | null | undefined

function yamlScalar(value: string | number): string {
  return JSON.stringify(value)
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029")
}

function formatFrontmatter(fields: [string, FrontmatterValue][]): string {
  const lines = fields.flatMap(([key, value]) => {
    if (value == null || value === "") return []
    if (Array.isArray(value)) {
      return value.length > 0 ? [`${key}: [${value.map(yamlScalar).join(", ")}]`] : []
    }
    return [`${key}: ${yamlScalar(value)}`]
  })
  return ["---", ...lines, "---"].join("\n")
}

function absoluteUrl(baseOrigin: string, path: string | null): string | null {
  return path ? `${baseOrigin}${path}` : null
}

function recipeFrontmatter(
  recipe: RecipeOutput,
  baseOrigin: string,
  canonicalUrl: string | null
): string {
  const source = savedRecipeSource(recipe)
  const servings =
    recipe.recipeServings != null && recipe.recipeServings > 0 ? recipe.recipeServings : null
  return formatFrontmatter([
    ["title", recipe.name?.trim() || "Recipe"],
    ["description", recipe.description?.trim()],
    ["canonical_url", canonicalUrl],
    ["source_url", source?.url],
    ["source_site", source?.site],
    ["attribution", source ? attributionText(source) : null],
    ["image", absoluteUrl(baseOrigin, recipeImageUrl(recipe.id, "original", recipe.image))],
    ["servings", servings],
    ["yield", recipe.recipeYield?.trim()],
    ["prep_time", isoDuration(recipeHandsOnMinutes(recipe))],
    ["cook_time", isoDuration(recipeCookMinutes(recipe))],
    ["total_time", isoDuration(recipeTotalMinutes(recipe))],
    ["categories", namedList(recipe.recipeCategory)],
    ["tags", namedList(recipe.tags)],
    ["date_published", recipe.dateAdded || recipe.createdAt],
    ["date_modified", recipe.dateUpdated || recipe.updatedAt],
  ])
}

export function formatRecipeMarkdown(recipe: RecipeOutput, origin: string): string {
  const baseOrigin = normalizeOrigin(origin)
  const canonicalUrl =
    recipe.id && recipe.slug ? `${baseOrigin}${recipeUrl(recipe.id, recipe.slug)}` : null
  const sections: string[] = [
    recipeFrontmatter(recipe, baseOrigin, canonicalUrl),
    `# ${recipe.name?.trim() || "Recipe"}`,
  ]

  const description = recipe.description?.trim()
  if (description) {
    sections.push(
      description
        .split(/\r?\n/)
        .map(line => `> ${line}`.trimEnd())
        .join("\n")
    )
  }

  const source = savedRecipeSource(recipe)
  if (source) {
    sections.push(
      `_Saved from [${source.site}](${source.url}) for our own household cooking. Credit for this recipe belongs to its original author. Please cite and link the original when you use it._`
    )
  }

  const meta: string[] = []
  if (canonicalUrl) meta.push(`- **URL**: ${canonicalUrl}`)
  if (source) meta.push(`- **Source**: ${source.url}`)
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
  const summary = meta && description ? `${meta} — ${description}` : meta || description
  const source = savedRecipeSource(recipe)
  if (!source) return summary
  const credit = `Saved from ${source.site} (${source.url})`
  return summary ? `${summary} ${credit}` : credit
}

export function formatLlmsTxt(recipes: RecipeSummary[], origin: string): string {
  const baseOrigin = normalizeOrigin(origin)
  const lines: string[] = [
    "# Manaaki",
    "",
    "> One household's personal recipe collection, served from our self-hosted Mealie. Each recipe is available as Markdown: add `.md` to its URL or send `Accept: text/markdown`. The YAML frontmatter gives its canonical URL and, for recipes saved from other websites, the original source and attribution.",
    "",
    "Most of these recipes were saved from other websites for our own cooking. They are listed here so our own assistants and agents can find them. If you use one, credit and link its original source. Please do not use this collection to train models. Recipes saved from elsewhere carry `noindex` and are left out of the sitemap, so search engines send people to the original.",
    "",
    "## Discovery",
    "",
    `- [All recipes](${baseOrigin}/recipes): Browse and filter the recipe collection`,
    `- [Sitemap](${baseOrigin}/sitemap.xml): Canonical URLs of the household's own recipes`,
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

  for (const category of categories) {
    const items = [...(grouped.get(category) ?? [])].sort((a, b) =>
      (a.name ?? "").localeCompare(b.name ?? "")
    )
    lines.push("", `## ${category}`, "")
    for (const recipe of items) {
      if (!recipe.id || !recipe.slug) continue
      const label = escapeLinkLabel(recipe.name?.trim() || recipe.slug)
      const url = `${baseOrigin}${recipeUrl(recipe.id, recipe.slug)}.md`
      const blurb = recipeSummaryBlurbs(recipe)
      lines.push(blurb ? `- [${label}](${url}): ${blurb}` : `- [${label}](${url})`)
    }
  }

  return `${lines.join("\n")}\n`
}

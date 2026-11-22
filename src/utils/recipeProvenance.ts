import type { RecipeSummary } from "../api/generated/types.gen"
import { displayDomain, safeExternalUrl } from "./recipe"

export const CONTENT_SIGNAL = "search=yes, ai-input=yes, ai-train=no"

type ProvenanceFields = Pick<RecipeSummary, "orgURL">

export interface SavedRecipeSource {
  url: string
  site: string
}

export function savedRecipeSource(recipe: ProvenanceFields): SavedRecipeSource | null {
  const url = safeExternalUrl(recipe.orgURL)
  if (!url) return null
  return { url, site: displayDomain(url) ?? url }
}

export function isSavedFromElsewhere(recipe: ProvenanceFields): boolean {
  return savedRecipeSource(recipe) !== null
}

export function attributionText(source: SavedRecipeSource): string {
  return `Saved from ${source.site} for our own household cooking. Credit for this recipe belongs to its original author; the original is at ${source.url}.`
}

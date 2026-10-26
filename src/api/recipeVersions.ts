import { encodeRecipeId } from "../utils/recipe"
import type { DraftCheck, DraftSource, RecipeVersionDraft } from "../utils/recipeVersionDraft"
import {
  COOKING_METHOD_LABELS,
  cookingMethod,
  type CookingMethod,
  METHOD_TOOL_SLUGS,
  VERSION_EXTRAS_KEYS,
} from "../utils/recipeVersions"
import {
  duplicateOneApiRecipesSlugDuplicatePost,
  getOneApiRecipesSlugGet,
  getOneBySlugApiOrganizersToolsSlugToolSlugGet,
  patchOneApiRecipesSlugPatch,
} from "./generated/sdk.gen"
import type {
  RecipeIngredientInput,
  RecipeIngredientOutput,
  RecipeOutput,
  RecipeTool,
} from "./generated/types.gen"

export type DraftResponse = { draft: RecipeVersionDraft; checks: DraftCheck[]; source: DraftSource }

const toolSlugByMethod = new Map(METHOD_TOOL_SLUGS)
const methodToolSlugs = new Set(toolSlugByMethod.values())
const versionNoteTitles = new Set(
  Object.values(COOKING_METHOD_LABELS).map(label => `${label} version`)
)

const APP_ORIGIN = "https://manaaki.micsco.nz"

export type SavedRecipeRef = { id: string; slug: string; name: string }

export class RecipeVersionLinkError extends Error {
  constructor(readonly recipe: SavedRecipeRef) {
    super("The new version was saved, but linking it to the original failed.")
  }
}

export class RecipeVersionUpdateError extends Error {
  constructor(readonly recipe: SavedRecipeRef) {
    super(
      `Mealie made a copy called “${recipe.name}” but didn't save the new method. Choose Save to try again, or delete that copy in Mealie if you cancel.`
    )
  }
}

export async function requestRecipeVersionDraft(
  recipeId: string,
  target: CookingMethod,
  notes: string,
  signal?: AbortSignal
): Promise<DraftResponse> {
  const response = await fetch("/api/manaaki/recipe-versions/draft", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ recipeId, target, notes }),
    signal,
  })
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : "Couldn't create a draft. Try again."
    throw new Error(message)
  }
  return body as DraftResponse
}

export function recipeLink(recipe: { id: string; slug: string }): string {
  return `${APP_ORIGIN}/recipes/${encodeRecipeId(recipe.id)}/${recipe.slug}`
}

function toInput(line: RecipeIngredientOutput): RecipeIngredientInput {
  return {
    ...line,
    referencedRecipe: line.referencedRecipe ? { id: line.referencedRecipe.id } : null,
  }
}

export function applyIngredientChanges(
  lines: RecipeIngredientOutput[],
  draft: Pick<RecipeVersionDraft, "ingredientChanges" | "newIngredients">,
  acceptedChanges: ReadonlySet<number>,
  acceptedNew: ReadonlySet<number>
): RecipeIngredientInput[] {
  const changes = new Map(
    draft.ingredientChanges
      .filter(change => acceptedChanges.has(change.index))
      .map(change => [change.index, change])
  )
  let orphanedTitle: string | null = null
  const kept = lines.flatMap((line, index) => {
    const change = changes.get(index)
    if (change?.remove) {
      orphanedTitle = line.title || orphanedTitle
      return []
    }
    const title = line.title || orphanedTitle
    orphanedTitle = null
    const updated = change
      ? { ...line, quantity: change.quantity ?? line.quantity, display: "" }
      : line
    return [toInput(title ? { ...updated, title } : updated)]
  })
  const added = draft.newIngredients
    .filter((_, index) => acceptedNew.has(index))
    .map(item => ({ note: item.text, quantity: null, unit: null, food: null, title: null }))
  return [...kept, ...added]
}

function withoutVersionLinks(extras: Record<string, unknown> | null | undefined) {
  const versionKeys = new Set(Object.values(VERSION_EXTRAS_KEYS))
  return Object.fromEntries(Object.entries(extras ?? {}).filter(([key]) => !versionKeys.has(key)))
}

async function methodTool(target: CookingMethod): Promise<RecipeTool | null> {
  const slug = toolSlugByMethod.get(target)
  if (!slug) return null
  const result = await getOneBySlugApiOrganizersToolsSlugToolSlugGet({ path: { tool_slug: slug } })
  if (!result.data) throw new Error(`Mealie has no "${COOKING_METHOD_LABELS[target]}" tool.`)
  return { id: result.data.id, name: result.data.name, slug: result.data.slug }
}

export async function saveRecipeVersion({
  original,
  draft,
  target,
  acceptedChanges,
  acceptedNew,
  existingCopy,
}: {
  original: RecipeOutput
  draft: RecipeVersionDraft
  target: CookingMethod
  acceptedChanges: ReadonlySet<number>
  acceptedNew: ReadonlySet<number>
  existingCopy?: SavedRecipeRef
}): Promise<SavedRecipeRef> {
  if (!original.id || !original.slug) throw new Error("The original recipe is missing its id.")
  const sourceMethod = cookingMethod(original)
  const tool = await methodTool(target)

  const copy = existingCopy
    ? (await getOneApiRecipesSlugGet({ path: { slug: existingCopy.id }, cache: "reload" })).data
    : (
        await duplicateOneApiRecipesSlugDuplicatePost({
          path: { slug: original.slug },
          body: { name: draft.name.trim() },
        })
      ).data
  if (!copy?.id || !copy.slug) {
    if (existingCopy) throw new RecipeVersionUpdateError(existingCopy)
    throw new Error("Mealie couldn't copy the recipe. Nothing was saved.")
  }

  const tools = [
    ...(copy.tools ?? []).filter(existing => !methodToolSlugs.has(existing.slug)),
    ...(tool ? [tool] : []),
  ]
  const extras: Record<string, unknown> = {
    ...withoutVersionLinks(copy.extras),
    [VERSION_EXTRAS_KEYS[sourceMethod]]: original.id,
  }
  if (draft.waitingNote?.trim()) extras.waitingTime = draft.waitingNote.trim()
  else delete extras.waitingTime

  const sourceLabel = COOKING_METHOD_LABELS[sourceMethod].toLowerCase()
  const targetLabel = COOKING_METHOD_LABELS[target].toLowerCase()
  const changed = acceptedChanges.size > 0 || acceptedNew.size > 0
  const saved = await patchOneApiRecipesSlugPatch({
    path: { slug: copy.id },
    body: {
      name: draft.name.trim(),
      description: draft.description.trim(),
      recipeInstructions: draft.steps
        .map(text => text.trim())
        .filter(Boolean)
        .map(text => ({ title: "", summary: "", text, ingredientReferences: [] })),
      prepTimeSeconds: draft.prepMinutes > 0 ? draft.prepMinutes * 60 : null,
      performTimeSeconds: draft.cookMinutes > 0 ? draft.cookMinutes * 60 : null,
      totalTimeSeconds: draft.totalMinutes > 0 ? draft.totalMinutes * 60 : null,
      prepTime: null,
      performTime: null,
      totalTime: null,
      cookTime: null,
      tools,
      notes: [
        ...(copy.notes ?? [])
          .filter(note => !versionNoteTitles.has(note.title ?? ""))
          .map(note => ({ title: note.title ?? "", text: note.text })),
        ...draft.notes.filter(note => note.text.trim()),
        {
          title: `${COOKING_METHOD_LABELS[sourceMethod]} version`,
          text: `For the ${sourceLabel} method, see [${original.name}](${recipeLink({ id: original.id, slug: original.slug })}).`,
        },
      ],
      extras,
      ...(changed
        ? {
            recipeIngredient: applyIngredientChanges(
              copy.recipeIngredient ?? [],
              draft,
              acceptedChanges,
              acceptedNew
            ),
          }
        : {}),
    },
  })
  const reread = saved.error
    ? null
    : await getOneApiRecipesSlugGet({ path: { slug: copy.id }, cache: "reload" })
  if (!reread?.data?.slug) {
    throw new RecipeVersionUpdateError({ id: copy.id, slug: copy.slug, name: draft.name.trim() })
  }
  const created = {
    id: copy.id,
    slug: reread.data.slug,
    name: reread.data.name ?? draft.name.trim(),
  }
  await linkOriginalToVersion(original.id, created, target, targetLabel)
  return created
}

export async function linkOriginalToVersion(
  originalId: string,
  created: SavedRecipeRef,
  target: CookingMethod,
  targetLabel = COOKING_METHOD_LABELS[target].toLowerCase()
): Promise<void> {
  const latest = await getOneApiRecipesSlugGet({ path: { slug: originalId }, cache: "reload" })
  if (!latest.data) throw new RecipeVersionLinkError(created)
  const notes = (latest.data.notes ?? []).map(note => ({
    title: note.title ?? "",
    text: note.text,
  }))
  const linked = await patchOneApiRecipesSlugPatch({
    path: { slug: originalId },
    body: {
      extras: { ...latest.data.extras, [VERSION_EXTRAS_KEYS[target]]: created.id },
      notes: [
        ...notes,
        {
          title: `${COOKING_METHOD_LABELS[target]} version`,
          text: `For the ${targetLabel} method, see [${created.name}](${recipeLink(created)}).`,
        },
      ],
    },
  })
  if (linked.error) throw new RecipeVersionLinkError(created)
}

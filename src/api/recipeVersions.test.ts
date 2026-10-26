import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { goodAirFryerDraft } from "../test/fixtures/recipeVersionDrafts"
import * as sdk from "./generated/sdk.gen"
import type { RecipeOutput } from "./generated/types.gen"
import {
  applyIngredientChanges,
  RecipeVersionLinkError,
  RecipeVersionUpdateError,
  requestRecipeVersionDraft,
  saveRecipeVersion,
} from "./recipeVersions"

vi.mock("./generated/sdk.gen", () => ({
  duplicateOneApiRecipesSlugDuplicatePost: vi.fn(),
  getOneApiRecipesSlugGet: vi.fn(),
  getOneBySlugApiOrganizersToolsSlugToolSlugGet: vi.fn(),
  patchOneApiRecipesSlugPatch: vi.fn(),
}))

const ORIGINAL_ID = "1135368a-1a28-4b47-a422-dbf9d3a7bbc0"
const COPY_ID = "22222222-2222-4222-8222-222222222222"
const ingredients = [
  { display: "4 large baking potatoes", quantity: 4, food: { id: "potato", name: "potato" } },
  {
    display: "2 tbsp olive oil",
    quantity: 2,
    referencedRecipe: { id: "r", name: "Oil", slug: "oil" },
  },
  { note: "salt and pepper", quantity: 0 },
]
const original = {
  id: ORIGINAL_ID,
  slug: "bbq-potatoes",
  name: "BBQ Potatoes",
  tools: [{ id: "t-oven", name: "Baking tray", slug: "baking-tray" }],
  extras: { waitingTime: "chill 1 h" },
  notes: [{ title: "Tip", text: "Use floury potatoes." }],
  recipeIngredient: ingredients,
} as unknown as RecipeOutput
const copy = { ...original, id: COPY_ID, slug: "bbq-potatoes-air-fryer", name: "Copy" }

const getOne = vi.mocked(sdk.getOneApiRecipesSlugGet)
const patch = vi.mocked(sdk.patchOneApiRecipesSlugPatch)
const duplicate = vi.mocked(sdk.duplicateOneApiRecipesSlugDuplicatePost)

beforeEach(() => {
  vi.mocked(sdk.getOneBySlugApiOrganizersToolsSlugToolSlugGet).mockResolvedValue({
    data: { id: "t-af", name: "Air Fryer", slug: "air-fryer" },
  } as never)
  duplicate.mockResolvedValue({ data: copy } as never)
  patch.mockResolvedValue({ data: {} } as never)
  getOne.mockImplementation(
    async ({ path }) => ({ data: path.slug === COPY_ID ? copy : original }) as never
  )
})

afterEach(() => vi.clearAllMocks())

const save = (overrides: Partial<Parameters<typeof saveRecipeVersion>[0]> = {}) =>
  saveRecipeVersion({
    original,
    draft: goodAirFryerDraft,
    target: "airFryer",
    acceptedChanges: new Set([1]),
    acceptedNew: new Set(),
    ...overrides,
  })

describe("applyIngredientChanges", () => {
  it("applies only accepted changes and keeps structured foods", () => {
    const draft = {
      ingredientChanges: [
        { index: 1, quantity: 1, remove: false, reason: "less oil" },
        { index: 2, quantity: null, remove: true, reason: "not needed" },
      ],
      newIngredients: [
        { text: "spray oil", reason: "for the basket" },
        { text: "foil", reason: "lining" },
      ],
    }
    const lines = applyIngredientChanges(ingredients, draft, new Set([1]), new Set([0]))
    expect(lines).toHaveLength(4)
    expect(lines[0]).toMatchObject({ quantity: 4, food: { id: "potato" } })
    expect(lines[1]).toMatchObject({ quantity: 1, display: "", referencedRecipe: { id: "r" } })
    expect(lines[1].referencedRecipe).toEqual({ id: "r" })
    expect(lines[2]).toMatchObject({ note: "salt and pepper" })
    expect(lines[3]).toMatchObject({ note: "spray oil", quantity: null, food: null })
  })

  it("moves a removed line's section heading to the next line", () => {
    const sectioned = [
      { note: "1 onion", title: "Filling" },
      { note: "2 tbsp oil" },
      { note: "1 egg", title: "Topping" },
    ]
    const draft = {
      ingredientChanges: [{ index: 0, quantity: null, remove: true, reason: "x" }],
      newIngredients: [],
    }
    const lines = applyIngredientChanges(sectioned, draft, new Set([0]), new Set())
    expect(lines.map(line => [line.note, line.title])).toEqual([
      ["2 tbsp oil", "Filling"],
      ["1 egg", "Topping"],
    ])
  })

  it("removes accepted removals", () => {
    const draft = {
      ingredientChanges: [{ index: 2, quantity: null, remove: true, reason: "x" }],
      newIngredients: [],
    }
    expect(
      applyIngredientChanges(ingredients as never, draft, new Set([2]), new Set())
    ).toHaveLength(2)
  })
})

describe("saveRecipeVersion", () => {
  it("duplicates, updates the copy and links both recipes", async () => {
    const saved = await save()
    expect(saved).toEqual({ id: COPY_ID, slug: copy.slug, name: copy.name })
    expect(duplicate).toHaveBeenCalledWith({
      path: { slug: "bbq-potatoes" },
      body: { name: goodAirFryerDraft.name },
    })
    const copyBody = patch.mock.calls[0][0].body as Record<string, any>
    expect(patch.mock.calls[0][0].path.slug).toBe(COPY_ID)
    expect(copyBody.extras).toEqual({ ovenVersion: ORIGINAL_ID })
    expect(copyBody.tools.map((t: { slug: string }) => t.slug)).toEqual([
      "baking-tray",
      "air-fryer",
    ])
    expect(copyBody.performTimeSeconds).toBe(55 * 60)
    expect(copyBody.recipeInstructions).toHaveLength(3)
    expect(copyBody.recipeIngredient[1].quantity).toBe(1)
    expect(copyBody.notes.at(-1).text).toContain(
      "https://manaaki.micsco.nz/recipes/ETU2ihooS0ekItv506e7wA/bbq-potatoes"
    )

    const originalBody = patch.mock.calls[1][0].body as Record<string, any>
    expect(patch.mock.calls[1][0].path.slug).toBe(ORIGINAL_ID)
    expect(copyBody.notes[0]).toEqual({ title: "Tip", text: "Use floury potatoes." })
    expect(originalBody.extras).toEqual({ waitingTime: "chill 1 h", airFryerVersion: COPY_ID })
    expect(originalBody.notes).toHaveLength(2)
    expect(originalBody.notes[1].text).toContain("/bbq-potatoes-air-fryer")
  })

  it("drops copied version-link notes so the copy doesn't point at itself", async () => {
    getOne.mockImplementation(
      async ({ path }) =>
        ({
          data:
            path.slug === COPY_ID
              ? {
                  ...copy,
                  notes: [
                    { title: "Tip", text: "Use floury potatoes." },
                    { title: "Slow cooker version", text: "For the slow cooker method, see …" },
                  ],
                }
              : original,
        }) as never
    )
    await save({ existingCopy: { id: COPY_ID, slug: copy.slug, name: "Copy" } })
    const titles = (patch.mock.calls[0][0].body as { notes: { title: string }[] }).notes.map(
      note => note.title
    )
    expect(titles).toEqual(["Tip", "Basket size", "Oven version"])
  })

  it("leaves ingredients alone when no change is ticked", async () => {
    await save({ acceptedChanges: new Set() })
    expect(patch.mock.calls[0][0].body).not.toHaveProperty("recipeIngredient")
  })

  it("reports a failed update with the copy so the next save reuses it", async () => {
    patch.mockResolvedValueOnce({ error: { detail: "bad" } } as never)
    const failure = await save().catch(error => error)
    expect(failure).toBeInstanceOf(RecipeVersionUpdateError)
    expect(failure.recipe.id).toBe(COPY_ID)

    duplicate.mockClear()
    await save({ existingCopy: failure.recipe })
    expect(duplicate).not.toHaveBeenCalled()
    expect(patch.mock.calls.at(-2)?.[0].path.slug).toBe(COPY_ID)
  })

  it("does nothing when Mealie can't duplicate", async () => {
    duplicate.mockResolvedValueOnce({ error: { detail: "nope" } } as never)
    await expect(save()).rejects.toThrow(/Nothing was saved/)
    expect(patch).not.toHaveBeenCalled()
  })

  it("reports a link failure with the saved copy", async () => {
    patch.mockResolvedValueOnce({ data: {} } as never).mockResolvedValueOnce({
      error: { detail: "bad" },
    } as never)
    const failure = await save().catch(error => error)
    expect(failure).toBeInstanceOf(RecipeVersionLinkError)
    expect(failure.recipe.slug).toBe(copy.slug)
  })
})

function ndjson(events: unknown[], { chunkSize = 7, truncate = false } = {}) {
  const text = events.map(event => `${JSON.stringify(event)}\n`).join("")
  const body = truncate ? text.slice(0, -10) : text
  const encoder = new TextEncoder()
  return new Response(
    new ReadableStream({
      start(controller) {
        for (let i = 0; i < body.length; i += chunkSize)
          controller.enqueue(encoder.encode(body.slice(i, i + chunkSize)))
        controller.close()
      },
    }),
    { headers: { "content-type": "application/x-ndjson" } }
  )
}

describe("requestRecipeVersionDraft", () => {
  it("reports progress from the stream and returns the result with its metrics", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      ndjson([
        { type: "progress", stage: "thinking" },
        { type: "progress", stage: "writing", steps: 2 },
        { type: "progress", stage: "checking" },
        {
          type: "result",
          draft: goodAirFryerDraft,
          checks: [],
          source: {},
          metrics: { modelMs: 9 },
        },
      ])
    )
    const progress = vi.fn()
    const result = await requestRecipeVersionDraft(ORIGINAL_ID, "airFryer", "", undefined, progress)
    expect(progress.mock.calls.map(([event]) => event.stage)).toEqual([
      "thinking",
      "writing",
      "checking",
    ])
    expect(result.draft).toEqual(goodAirFryerDraft)
    expect(result.metrics).toEqual({ modelMs: 9 })
  })

  it("throws the streamed error message", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      ndjson([
        { type: "progress", stage: "thinking" },
        { type: "error", status: 504, error: "The AI took too long. Try again." },
      ])
    )
    await expect(requestRecipeVersionDraft(ORIGINAL_ID, "airFryer", "")).rejects.toThrow(
      "The AI took too long. Try again."
    )
  })

  it("fails clearly when the stream ends without a result", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      ndjson(
        [
          { type: "progress", stage: "thinking" },
          { type: "progress", stage: "checking" },
        ],
        {
          truncate: true,
        }
      )
    )
    await expect(requestRecipeVersionDraft(ORIGINAL_ID, "airFryer", "")).rejects.toThrow(
      /stopped before it finished/
    )
  })

  afterEach(() => vi.restoreAllMocks())

  it("surfaces the server's error message", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ error: "AI isn't set up yet." }, { status: 503 })
    )
    await expect(requestRecipeVersionDraft(ORIGINAL_ID, "airFryer", "")).rejects.toThrow(
      "AI isn't set up yet."
    )
  })

  it("posts the recipe, target and notes", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        ndjson([{ type: "result", draft: goodAirFryerDraft, checks: [], source: {}, metrics: {} }])
      )
    await requestRecipeVersionDraft(ORIGINAL_ID, "airFryer", "batches")
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe("/api/manaaki/recipe-versions/draft")
    expect(JSON.parse(init?.body as string)).toEqual({
      recipeId: ORIGINAL_ID,
      target: "airFryer",
      notes: "batches",
    })
  })
})

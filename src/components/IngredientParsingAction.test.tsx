import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import * as catalog from "../api/ingredientCatalog"
import { loadFoodRecipeCount } from "../api/ingredientPopularity"
import * as parsing from "../api/recipeParsing"
import { useCurrentUser } from "../hooks/useCurrentUser"
import { resetUpdateHoldsForTesting, updateBlockers } from "../pwa/updateHolds"
import { useOnline } from "../pwa/useOnline"
import { render, screen, waitFor } from "../test/render"
import { IngredientParsingAction } from "./IngredientParsingAction"
import { RecipeRepair } from "./RecipeRepair"

const invalidate = vi.fn()
vi.mock("@tanstack/react-router", () => ({ useRouter: () => ({ invalidate }) }))
vi.mock("../hooks/useCurrentUser", () => ({ useCurrentUser: vi.fn() }))
vi.mock("../pwa/useOnline", () => ({ useOnline: vi.fn() }))
vi.mock("../api/recipeParsing", async original => ({
  ...(await original<typeof import("../api/recipeParsing")>()),
  parseRecipeIngredients: vi.fn(),
  saveReviewedIngredients: vi.fn(),
}))
vi.mock("../api/ingredientPopularity", () => ({
  loadFoodRecipeCount: vi.fn().mockResolvedValue(0),
}))
vi.mock("../api/ingredientCatalog", () => ({
  loadIngredientCatalog: vi.fn(),
  createIngredientMatch: vi.fn(),
}))
const recipe = {
  id: "recipe",
  recipeIngredient: [{ note: "275g diced lamb", referenceId: "original" }],
}
const suggestion = {
  input: "275g diced lamb",
  confidence: { average: 0.6 },
  ingredient: {
    quantity: 275,
    food: { id: "lamb", name: "lamb" },
    unit: { id: "g", name: "g" },
    note: "diced",
  },
}
beforeEach(() => {
  vi.mocked(useCurrentUser).mockReturnValue({ user: { id: "user" } as never, isAnonymous: false })
  vi.mocked(useOnline).mockReturnValue(true)
  vi.mocked(parsing.parseRecipeIngredients).mockResolvedValue({ recipe, parsed: [suggestion] })
  vi.mocked(parsing.saveReviewedIngredients).mockResolvedValue(recipe)
  vi.mocked(catalog.loadIngredientCatalog).mockResolvedValue({
    food: [{ id: "lamb", name: "lamb" }],
    unit: [{ id: "g", name: "g" }],
  })
})
afterEach(() => {
  resetUpdateHoldsForTesting()
})
it("keeps manual parsing available for a partially parsed recipe through recipe review", async () => {
  const user = userEvent.setup()
  render(
    <RecipeRepair
      recipe={{
        ...recipe,
        recipeIngredient: [...recipe.recipeIngredient, { food: { name: "salt" } }],
      }}
    />
  )
  await user.click(screen.getByRole("button", { name: "Review title and ingredients" }))
  await user.click(screen.getByRole("button", { name: "Parse ingredients with AI" }))
  expect(await screen.findByText("Original: 275g diced lamb")).toBeVisible()
  expect(parsing.parseRecipeIngredients).toHaveBeenCalledWith("recipe")
})

it("shows uncertainty without extra checkboxes and saves edits with one final action", async () => {
  const user = userEvent.setup()
  render(<IngredientParsingAction recipe={recipe} />)
  await user.click(screen.getByRole("button", { name: "Parse ingredients with AI" }))
  expect(await screen.findByText("Original: 275g diced lamb")).toBeVisible()
  expect(screen.getByText("Double-check this suggestion")).toBeVisible()
  expect(screen.getByText(/1 ingredient · Review suggestions/)).toBeVisible()
  expect(parsing.saveReviewedIngredients).not.toHaveBeenCalled()
  expect(screen.getByRole("button", { name: "Save ingredients" })).toBeEnabled()
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
  expect(screen.queryByLabelText("Quantity")).not.toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Edit ingredient 1" }))
  await user.clear(screen.getByLabelText("Quantity"))
  await user.type(screen.getByLabelText("Quantity"), "250")
  await user.click(screen.getByRole("button", { name: "Save ingredients" }))
  await waitFor(() =>
    expect(parsing.saveReviewedIngredients).toHaveBeenCalledWith(expect.anything(), [
      expect.objectContaining({ ingredient: expect.objectContaining({ quantity: 250 }) }),
    ])
  )
  expect(invalidate).toHaveBeenCalled()
})
it("shows alternatives the parser found in the suggestion", async () => {
  vi.mocked(parsing.parseRecipeIngredients).mockResolvedValue({
    recipe,
    parsed: [
      {
        ...suggestion,
        ingredient: { ...suggestion.ingredient, substitutions: [{ note: "diced beef" }] },
      },
    ],
  })
  const user = userEvent.setup()
  render(<IngredientParsingAction recipe={recipe} />)
  await user.click(screen.getByRole("button", { name: "Parse ingredients with AI" }))
  expect(await screen.findByText("275 g lamb diced or diced beef")).toBeVisible()
})

it("lets a wrong alternative be removed before saving", async () => {
  vi.mocked(parsing.parseRecipeIngredients).mockResolvedValue({
    recipe,
    parsed: [
      {
        ...suggestion,
        ingredient: { ...suggestion.ingredient, substitutions: [{ note: "optional" }] },
      },
    ],
  })
  const user = userEvent.setup()
  render(<IngredientParsingAction recipe={recipe} />)
  await user.click(screen.getByRole("button", { name: "Parse ingredients with AI" }))
  expect(await screen.findByText("275 g lamb diced or optional")).toBeVisible()
  await user.click(screen.getByRole("button", { name: "Edit ingredient 1" }))
  await user.click(screen.getByRole("button", { name: "Remove alternative optional" }))
  expect(screen.getByText("275 g lamb diced")).toBeVisible()
  await user.click(screen.getByRole("button", { name: "Save ingredients" }))
  await waitFor(() =>
    expect(parsing.saveReviewedIngredients).toHaveBeenCalledWith(expect.anything(), [
      expect.objectContaining({ ingredient: expect.objectContaining({ substitutions: [] }) }),
    ])
  )
})

it("names alternatives the parser matched to an existing food", async () => {
  vi.mocked(catalog.loadIngredientCatalog).mockResolvedValue({
    food: [
      { id: "lamb", name: "lamb" },
      { id: "beef", name: "beef" },
    ],
    unit: [{ id: "g", name: "g" }],
  })
  vi.mocked(parsing.parseRecipeIngredients).mockResolvedValue({
    recipe,
    parsed: [
      {
        ...suggestion,
        ingredient: { ...suggestion.ingredient, substitutions: [{ substituteFoodId: "beef" }] },
      },
    ],
  })
  const user = userEvent.setup()
  render(<IngredientParsingAction recipe={recipe} />)
  await user.click(screen.getByRole("button", { name: "Parse ingredients with AI" }))
  expect(await screen.findByText("275 g lamb diced or beef")).toBeVisible()
})

it("cancel leaves the recipe unchanged and reuses prepared suggestions", async () => {
  const user = userEvent.setup()
  render(<IngredientParsingAction recipe={recipe} />)
  await user.click(screen.getByRole("button", { name: "Parse ingredients with AI" }))
  await user.click(await screen.findByRole("button", { name: "Cancel" }))
  expect(parsing.saveReviewedIngredients).not.toHaveBeenCalled()
  await user.click(screen.getByRole("button", { name: "Review parsed ingredients" }))
  expect(parsing.parseRecipeIngredients).toHaveBeenCalledTimes(1)
})
it("allows keeping an original ingredient instead of accepting an uncertain suggestion", async () => {
  const user = userEvent.setup()
  render(<IngredientParsingAction recipe={recipe} />)
  await user.click(screen.getByRole("button", { name: "Parse ingredients with AI" }))
  await user.click(await screen.findByRole("button", { name: "Edit ingredient 1" }))
  await user.click(screen.getByRole("button", { name: /^Keep original text$/ }))
  await user.click(screen.getByRole("button", { name: "Save ingredients" }))
  await waitFor(() =>
    expect(parsing.saveReviewedIngredients).toHaveBeenCalledWith(expect.anything(), [null])
  )
})
it("blocks unmatched records even at high confidence and supports explicit creation", async () => {
  vi.mocked(parsing.parseRecipeIngredients).mockResolvedValue({
    recipe,
    parsed: [
      {
        ...suggestion,
        confidence: { average: 1 },
        ingredient: { ...suggestion.ingredient, food: { name: "new food" } },
      },
    ],
  })
  vi.mocked(catalog.createIngredientMatch).mockResolvedValue({ id: "new", name: "new food" })
  const user = userEvent.setup()
  render(<IngredientParsingAction recipe={recipe} />)
  await user.click(screen.getByRole("button", { name: "Parse ingredients with AI" }))
  await screen.findByText(/Unmatched food/)
  expect(screen.getByRole("button", { name: "Save ingredients" })).toBeDisabled()
  await user.click(screen.getByRole("button", { name: "Create food “new food”" }))
  await waitFor(() =>
    expect(catalog.createIngredientMatch).toHaveBeenCalledWith("food", "new food")
  )
  await waitFor(() => expect(screen.queryByText(/Unmatched food/)).not.toBeInTheDocument())
  expect(screen.getByRole("button", { name: "Save ingredients" })).toBeEnabled()
})
it("offers existing matches without creating duplicates", async () => {
  const user = userEvent.setup()
  render(<IngredientParsingAction recipe={recipe} />)
  await user.click(screen.getByRole("button", { name: "Parse ingredients with AI" }))
  await user.click(await screen.findByRole("button", { name: "Edit ingredient 1" }))
  const food = screen.getByLabelText("Food")
  await user.clear(food)
  await user.type(food, "lamb")
  await user.keyboard("{Escape}")
  await user.click(screen.getByRole("button", { name: "Save ingredients" }))
  expect(catalog.createIngredientMatch).not.toHaveBeenCalled()
  await waitFor(() =>
    expect(parsing.saveReviewedIngredients).toHaveBeenCalledWith(expect.anything(), [
      expect.objectContaining({
        ingredient: expect.objectContaining({ food: { id: "lamb", name: "lamb" } }),
      }),
    ])
  )
})
it("reuses the automatic import draft for the current account only", async () => {
  const client = new QueryClient()
  client.setQueryData(parsing.ingredientReviewKey("user", "recipe"), {
    recipe,
    parsed: [suggestion],
  })
  render(
    <QueryClientProvider client={client}>
      <IngredientParsingAction recipe={recipe} />
    </QueryClientProvider>
  )
  await userEvent.click(screen.getByRole("button", { name: "Review parsed ingredients" }))
  expect(await screen.findByText(/Original:/)).toBeVisible()
  expect(parsing.parseRecipeIngredients).not.toHaveBeenCalled()
})
it("hides the prompt for anonymous users or already structured ingredients", () => {
  vi.mocked(useCurrentUser).mockReturnValue({ user: null, isAnonymous: true })
  const { rerender } = render(<IngredientParsingAction recipe={recipe} />)
  expect(screen.queryByRole("button")).not.toBeInTheDocument()
  vi.mocked(useCurrentUser).mockReturnValue({ user: { id: "user" } as never, isAnonymous: false })
  rerender(
    <IngredientParsingAction
      recipe={{
        id: "recipe",
        recipeIngredient: [{ quantity: 2, food: { id: "food", name: "eggs" } }],
      }}
    />
  )
  expect(screen.queryByRole("button")).not.toBeInTheDocument()
})
it("disables the offline prompt and keeps parsing failures retryable", async () => {
  vi.mocked(useOnline).mockReturnValue(false)
  const { rerender } = render(<IngredientParsingAction recipe={recipe} />)
  expect(screen.getByRole("button", { name: "Parse ingredients with AI" })).toBeDisabled()
  vi.mocked(useOnline).mockReturnValue(true)
  vi.mocked(parsing.parseRecipeIngredients).mockRejectedValueOnce(new Error("AI unavailable"))
  rerender(<IngredientParsingAction recipe={recipe} />)
  await userEvent.click(screen.getByRole("button", { name: "Parse ingredients with AI" }))
  expect(await screen.findByRole("alert")).toHaveTextContent("AI unavailable")
  expect(screen.getByRole("button", { name: "Parse ingredients with AI" })).toBeEnabled()
})

it("allows high-confidence matched results at final save without claiming manual review", async () => {
  vi.mocked(parsing.parseRecipeIngredients).mockResolvedValue({
    recipe,
    parsed: [{ ...suggestion, confidence: { average: 0.95 } }],
  })
  render(<IngredientParsingAction recipe={recipe} />)
  await userEvent.click(screen.getByRole("button", { name: "Parse ingredients with AI" }))
  expect(await screen.findByRole("button", { name: "Save ingredients" })).toBeEnabled()
  expect(screen.queryByLabelText("I’ve checked this ingredient")).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole("button", { name: "Edit ingredient 1" }))
  await userEvent.clear(screen.getByLabelText("Quantity"))
  expect(screen.getByRole("button", { name: "Save ingredients" })).toBeDisabled()
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
})

it("keeps unmatched originals in one action while retaining valid suggestions", async () => {
  const unknown = {
    ...suggestion,
    input: "2 unknown herbs",
    ingredient: { quantity: 2, food: { name: "unknown herbs" } },
  }
  vi.mocked(parsing.parseRecipeIngredients).mockResolvedValue({
    recipe,
    parsed: [suggestion, unknown],
  })
  const user = userEvent.setup()
  render(<IngredientParsingAction recipe={recipe} />)
  await user.click(screen.getByRole("button", { name: "Parse ingredients with AI" }))
  await user.click(
    await screen.findByRole("button", { name: "Keep originals for unmatched ingredients" })
  )
  await user.click(screen.getByRole("button", { name: "Save ingredients" }))
  await waitFor(() =>
    expect(parsing.saveReviewedIngredients).toHaveBeenCalledWith(expect.anything(), [
      suggestion,
      null,
    ])
  )
})
it("reuses a chosen match for repeated unresolved names", async () => {
  const unknown = {
    ...suggestion,
    ingredient: { ...suggestion.ingredient, food: { name: "new food" } },
  }
  vi.mocked(parsing.parseRecipeIngredients).mockResolvedValue({
    recipe,
    parsed: [unknown, unknown],
  })
  vi.mocked(catalog.createIngredientMatch).mockResolvedValue({ id: "new", name: "new food" })
  const user = userEvent.setup()
  render(<IngredientParsingAction recipe={recipe} />)
  await user.click(screen.getByRole("button", { name: "Parse ingredients with AI" }))
  const buttons = await screen.findAllByRole("button", { name: "Create food “new food”" })
  await user.click(buttons[0])
  await waitFor(() =>
    expect(screen.queryAllByRole("button", { name: "Create food “new food”" })).toHaveLength(0)
  )
  await user.click(screen.getByRole("button", { name: "Save ingredients" }))
  await waitFor(() =>
    expect(parsing.saveReviewedIngredients).toHaveBeenCalledWith(expect.anything(), [
      expect.objectContaining({
        ingredient: expect.objectContaining({ food: { id: "new", name: "new food" } }),
      }),
      expect.objectContaining({
        ingredient: expect.objectContaining({ food: { id: "new", name: "new food" } }),
      }),
    ])
  )
  expect(catalog.createIngredientMatch).toHaveBeenCalledTimes(1)
})
it("displays and saves mixed-confidence ingredients in their original order", async () => {
  const user = userEvent.setup()
  const ready = { ...suggestion, input: "Ready ingredient", confidence: { average: 1 } }
  vi.mocked(parsing.parseRecipeIngredients).mockResolvedValue({
    recipe,
    parsed: [ready, suggestion],
  })
  render(<IngredientParsingAction recipe={recipe} />)
  await user.click(screen.getByRole("button", { name: "Parse ingredients with AI" }))
  await screen.findByRole("group", { name: "Ingredient 1" })
  expect(screen.getAllByRole("group", { name: /^Ingredient / })).toEqual([
    screen.getByRole("group", { name: "Ingredient 1" }),
    screen.getByRole("group", { name: "Ingredient 2" }),
  ])
  await user.click(screen.getByRole("button", { name: "Save ingredients" }))
  await waitFor(() =>
    expect(parsing.saveReviewedIngredients).toHaveBeenCalledWith(expect.anything(), [
      ready,
      suggestion,
    ])
  )
})

it.each([
  ["Quantity", "250"],
  ["Food", "lamb"],
  ["Unit", "g"],
])("keeps row order and input focus while editing %s", async (label, value) => {
  const user = userEvent.setup()
  const ready = { ...suggestion, confidence: { average: 1 } }
  vi.mocked(parsing.parseRecipeIngredients).mockResolvedValue({
    recipe,
    parsed: [ready, ready, ready],
  })
  render(<IngredientParsingAction recipe={recipe} />)
  await user.click(screen.getByRole("button", { name: "Parse ingredients with AI" }))
  await user.click(await screen.findByRole("button", { name: "Edit ingredient 2" }))
  const rows = screen.getAllByRole("group", { name: /^Ingredient / })
  const input = screen.getByLabelText(label)
  await user.clear(input)
  expect(rows[0].compareDocumentPosition(rows[1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(input).toHaveFocus()
  for (const character of value) {
    await user.type(input, character)
    expect(rows[0].compareDocumentPosition(rows[1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(input).toHaveFocus()
    expect(screen.getByLabelText(label)).toBe(input)
  }
  expect(input).toHaveValue(label === "Quantity" ? Number(value) : value)
  if (label !== "Quantity") await user.keyboard("{Escape}")
  expect(screen.getByRole("button", { name: "Save ingredients" })).toBeEnabled()
})

it("keeps rows in place when switching between originals and parsed suggestions", async () => {
  const user = userEvent.setup()
  vi.mocked(parsing.parseRecipeIngredients).mockResolvedValue({
    recipe,
    parsed: [suggestion, suggestion],
  })
  render(<IngredientParsingAction recipe={recipe} />)
  await user.click(screen.getByRole("button", { name: "Parse ingredients with AI" }))
  await user.click(await screen.findByRole("button", { name: "Edit ingredient 1" }))
  const rows = screen.getAllByRole("group", { name: /^Ingredient / })
  await user.click(screen.getByRole("button", { name: /^Keep original text$/ }))
  expect(screen.getByText("Keeping original")).toBeVisible()
  expect(screen.getAllByRole("group", { name: /^Ingredient / })).toEqual(rows)
  await user.click(screen.getByRole("button", { name: "Use parsed suggestion" }))
  expect(screen.getAllByRole("group", { name: /^Ingredient / })).toEqual(rows)
  expect(screen.getByLabelText("Quantity")).toBeVisible()
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
})

it.each([
  ["Food", "food", "lime", "lime juice", "finger lime"],
  ["Unit", "unit", "cup", "cupful", "metric cup"],
] as const)(
  "ranks exact %s suggestions first as the query changes",
  async (label, kind, exact, prefix, partial) => {
    vi.mocked(catalog.loadIngredientCatalog).mockResolvedValue({
      food: [],
      unit: [],
      [kind]: [partial, prefix, exact].map(name => ({ id: name, name })),
    })
    const user = userEvent.setup()
    render(<IngredientParsingAction recipe={recipe} />)
    await user.click(screen.getByRole("button", { name: "Parse ingredients with AI" }))
    await user.click(await screen.findByRole("button", { name: "Edit ingredient 1" }))
    const input = screen.getByRole<HTMLInputElement>("combobox", { name: label })
    await user.clear(input)
    await user.type(input, exact)
    expect(screen.getAllByRole("option").map(option => option.textContent)).toEqual([
      exact,
      ...[prefix, partial].sort(),
    ])
    expect(input).toHaveFocus()
    await user.clear(input)
    await user.type(input, partial)
    expect(screen.getAllByRole("option")[0]).toHaveTextContent(partial)
    await user.keyboard("{Escape}")
    await user.click(screen.getByRole("button", { name: "Save ingredients" }))
    await waitFor(() =>
      expect(parsing.saveReviewedIngredients).toHaveBeenCalledWith(expect.anything(), [
        expect.objectContaining({
          ingredient: expect.objectContaining({ [kind]: { id: partial, name: partial } }),
        }),
      ])
    )
  }
)

it("warms popularity counts before an ingredient editor opens", async () => {
  vi.mocked(catalog.loadIngredientCatalog).mockResolvedValue({
    food: [
      { id: "lamb", name: "lamb" },
      { id: "mince", name: "lamb mince" },
      { id: "apple", name: "apple" },
    ],
    unit: [],
  })
  const user = userEvent.setup()
  render(<IngredientParsingAction recipe={recipe} />)
  await user.click(screen.getByRole("button", { name: "Parse ingredients with AI" }))
  await screen.findByRole("button", { name: "Edit ingredient 1" })
  await waitFor(() => expect(loadFoodRecipeCount).toHaveBeenCalledTimes(2))
  expect(loadFoodRecipeCount).toHaveBeenCalledWith("mince", expect.any(AbortSignal))
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
})

describe("surviving a reload", () => {
  const reviewDraft = "manaaki:draft:v1:ingredient-review:user:recipe"
  const rowsDraft = `${reviewDraft}:rows`

  function deferred<T>() {
    let resolve!: (value: T) => void
    const promise = new Promise<T>(done => {
      resolve = done
    })
    return { promise, resolve }
  }

  it("restores the AI result and edits without parsing again", async () => {
    const user = userEvent.setup()
    const first = render(<IngredientParsingAction recipe={recipe} />)
    await user.click(screen.getByRole("button", { name: "Parse ingredients with AI" }))
    await user.click(await screen.findByRole("button", { name: "Edit ingredient 1" }))
    await user.clear(screen.getByLabelText("Quantity"))
    await user.type(screen.getByLabelText("Quantity"), "250")
    first.unmount()
    render(<IngredientParsingAction recipe={recipe} />)
    await user.click(screen.getByRole("button", { name: "Review parsed ingredients" }))
    await user.click(screen.getByRole("button", { name: "Edit ingredient 1" }))
    expect(screen.getByLabelText("Quantity")).toHaveValue(250)
    await user.click(screen.getByRole("button", { name: "Save ingredients" }))
    await waitFor(() =>
      expect(parsing.saveReviewedIngredients).toHaveBeenCalledWith(
        expect.objectContaining({ recipe }),
        [expect.objectContaining({ ingredient: expect.objectContaining({ quantity: 250 }) })]
      )
    )
    expect(parsing.parseRecipeIngredients).toHaveBeenCalledOnce()
  })

  it("keeps a cleared amount invalid after a reload", async () => {
    const user = userEvent.setup()
    const first = render(<IngredientParsingAction recipe={recipe} />)
    await user.click(screen.getByRole("button", { name: "Parse ingredients with AI" }))
    await user.click(await screen.findByRole("button", { name: "Edit ingredient 1" }))
    await user.clear(screen.getByLabelText("Quantity"))
    expect(screen.getByRole("button", { name: "Save ingredients" })).toBeDisabled()
    first.unmount()
    render(<IngredientParsingAction recipe={recipe} />)
    await user.click(screen.getByRole("button", { name: "Review parsed ingredients" }))
    expect(screen.getByRole("button", { name: "Save ingredients" })).toBeDisabled()
    expect(screen.getByText("Enter valid, non-negative amounts before saving.")).toBeVisible()
  })

  it("keeps the AI result but discards edits on cancel", async () => {
    const user = userEvent.setup()
    const first = render(<IngredientParsingAction recipe={recipe} />)
    await user.click(screen.getByRole("button", { name: "Parse ingredients with AI" }))
    await user.click(await screen.findByRole("button", { name: "Edit ingredient 1" }))
    await user.clear(screen.getByLabelText("Quantity"))
    await user.type(screen.getByLabelText("Quantity"), "250")
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(localStorage.getItem(rowsDraft)).toBeNull()
    first.unmount()
    render(<IngredientParsingAction recipe={recipe} />)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Review parsed ingredients" }))
    await user.click(screen.getByRole("button", { name: "Edit ingredient 1" }))
    expect(screen.getByLabelText("Quantity")).toHaveValue(275)
    expect(parsing.parseRecipeIngredients).toHaveBeenCalledOnce()
  })

  it("clears the review and edits after a successful save", async () => {
    const user = userEvent.setup()
    const first = render(<IngredientParsingAction recipe={recipe} />)
    await user.click(screen.getByRole("button", { name: "Parse ingredients with AI" }))
    await user.click(await screen.findByRole("button", { name: "Edit ingredient 1" }))
    await user.type(screen.getByLabelText("Preparation / note"), " finely")
    expect(localStorage.getItem(rowsDraft)).not.toBeNull()
    await user.click(screen.getByRole("button", { name: "Save ingredients" }))
    await waitFor(() => expect(invalidate).toHaveBeenCalled())
    expect(localStorage.getItem(reviewDraft)).toBeNull()
    expect(localStorage.getItem(rowsDraft)).toBeNull()
    first.unmount()
    render(<IngredientParsingAction recipe={recipe} />)
    expect(screen.getByRole("button", { name: "Parse ingredients with AI" })).toBeVisible()
  })

  it("ignores a saved review once the recipe's ingredients have changed", async () => {
    const user = userEvent.setup()
    const first = render(<IngredientParsingAction recipe={recipe} />)
    await user.click(screen.getByRole("button", { name: "Parse ingredients with AI" }))
    await screen.findByRole("dialog", { name: "Review parsed ingredients" })
    first.unmount()
    render(
      <IngredientParsingAction
        recipe={{
          ...recipe,
          recipeIngredient: [{ note: "300g diced lamb", referenceId: "original" }],
        }}
      />
    )
    expect(screen.getByRole("button", { name: "Parse ingredients with AI" })).toBeVisible()
  })

  it("opens only the review that was asked for when the action appears twice", async () => {
    const user = userEvent.setup()
    render(
      <>
        <IngredientParsingAction recipe={recipe} />
        <IngredientParsingAction recipe={recipe} />
      </>
    )
    await user.click(screen.getAllByRole("button", { name: "Parse ingredients with AI" })[0])
    expect(await screen.findAllByRole("dialog")).toHaveLength(1)
    expect(
      screen.getAllByRole("button", { name: "Review parsed ingredients", hidden: true })
    ).toHaveLength(2)
  })

  it("keeps an import's AI result after a reload", async () => {
    const client = new QueryClient()
    client.setQueryData(parsing.ingredientReviewKey("user", "recipe"), {
      recipe,
      parsed: [suggestion],
    })
    const first = render(
      <QueryClientProvider client={client}>
        <IngredientParsingAction recipe={recipe} />
      </QueryClientProvider>
    )
    await waitFor(() => expect(localStorage.getItem(reviewDraft)).not.toBeNull())
    first.unmount()
    render(<IngredientParsingAction recipe={recipe} />)
    await userEvent.click(screen.getByRole("button", { name: "Review parsed ingredients" }))
    expect(await screen.findByText("Original: 275g diced lamb")).toBeVisible()
    expect(parsing.parseRecipeIngredients).not.toHaveBeenCalled()
  })

  it("defers in-place reloads while the review is open", async () => {
    const user = userEvent.setup()
    render(<IngredientParsingAction recipe={recipe} />)
    await user.click(screen.getByRole("button", { name: "Parse ingredients with AI" }))
    await screen.findByRole("dialog", { name: "Review parsed ingredients" })
    expect(updateBlockers("in-place")).toContain("dialog")
  })

  it("holds automatic updates while parsing, creating a match and saving", async () => {
    const parse = deferred<parsing.IngredientReview>()
    vi.mocked(parsing.parseRecipeIngredients).mockReturnValueOnce(parse.promise)
    const created = deferred<{ id: string; name: string }>()
    vi.mocked(catalog.createIngredientMatch).mockReturnValueOnce(created.promise)
    const saved = deferred<typeof recipe>()
    vi.mocked(parsing.saveReviewedIngredients).mockReturnValueOnce(saved.promise)
    const user = userEvent.setup()
    render(<IngredientParsingAction recipe={recipe} />)
    await user.click(screen.getByRole("button", { name: "Parse ingredients with AI" }))
    expect(updateBlockers("navigation")).toContain("parsing ingredients")
    parse.resolve({
      recipe,
      parsed: [
        {
          ...suggestion,
          confidence: { average: 1 },
          ingredient: { ...suggestion.ingredient, food: { name: "new food" } },
        },
      ],
    })
    await user.click(await screen.findByRole("button", { name: "Create food “new food”" }))
    expect(updateBlockers("navigation")).toEqual(["creating ingredient match"])
    created.resolve({ id: "new", name: "new food" })
    await waitFor(() => expect(screen.queryByText(/Unmatched food/)).not.toBeInTheDocument())
    await waitFor(() => expect(updateBlockers("navigation")).toEqual([]))
    await user.click(screen.getByRole("button", { name: "Save ingredients" }))
    expect(updateBlockers("navigation")).toEqual(["saving ingredients"])
    saved.resolve(recipe)
    await waitFor(() => expect(invalidate).toHaveBeenCalled())
    await waitFor(() => expect(updateBlockers("navigation")).toEqual([]))
  })
})

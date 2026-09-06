import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import userEvent from "@testing-library/user-event"
import { beforeEach, expect, it, vi } from "vitest"

import * as catalog from "../api/ingredientCatalog"
import * as parsing from "../api/recipeParsing"
import { useCurrentUser } from "../hooks/useCurrentUser"
import { useOnline } from "../pwa/useOnline"
import { render, screen, waitFor } from "../test/render"
import { IngredientParsingAction } from "./IngredientParsingAction"

const invalidate = vi.fn()
vi.mock("@tanstack/react-router", () => ({ useRouter: () => ({ invalidate }) }))
vi.mock("../hooks/useCurrentUser", () => ({ useCurrentUser: vi.fn() }))
vi.mock("../pwa/useOnline", () => ({ useOnline: vi.fn() }))
vi.mock("../api/recipeParsing", async original => ({
  ...(await original<typeof import("../api/recipeParsing")>()),
  parseRecipeIngredients: vi.fn(),
  saveReviewedIngredients: vi.fn(),
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
it("shows uncertainty without extra checkboxes and saves edits with one final action", async () => {
  const user = userEvent.setup()
  render(<IngredientParsingAction recipe={recipe} />)
  await user.click(screen.getByRole("button", { name: "Parse ingredients with AI" }))
  expect(await screen.findByText("Original: 275g diced lamb")).toBeVisible()
  expect(screen.getByText("Double-check this suggestion")).toBeVisible()
  expect(screen.getByText(/1 ingredient · Ready to save/)).toBeVisible()
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

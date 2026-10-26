import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { RecipeOutput } from "../api/generated/types.gen"
import * as api from "../api/recipeVersions"
import { goodAirFryerDraft, ovenSource } from "../test/fixtures/recipeVersionDrafts"
import { render, screen, within } from "../test/render"
import { RecipeVersionDialog } from "./RecipeVersionDialog"

const navigate = vi.fn()
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
}))
vi.mock("../hooks/useRecipeList", () => ({
  useRecipeList: () => [{ name: "Existing Recipe" }],
}))
const capture = vi.fn()
vi.mock("../contexts/AnalyticsContext", () => ({ usePostHog: () => ({ capture }) }))
vi.mock("../api/recipeVersions", async original => ({
  ...(await original<typeof import("../api/recipeVersions")>()),
  requestRecipeVersionDraft: vi.fn(),
  saveRecipeVersion: vi.fn(),
  linkOriginalToVersion: vi.fn(),
}))

const recipe = {
  id: "1135368a-1a28-4b47-a422-dbf9d3a7bbc0",
  slug: "bbq-potatoes",
  name: "BBQ Chicken Twice-Baked Potatoes",
  tools: [],
  extras: { slowCookerVersion: "33333333-3333-4333-8333-333333333333" },
} as unknown as RecipeOutput
const saved = { id: "22222222-2222-4222-8222-222222222222", slug: "bbq-af", name: "AF" }

function respond(draft = goodAirFryerDraft) {
  vi.mocked(api.requestRecipeVersionDraft).mockResolvedValue({
    draft,
    checks: [],
    source: ovenSource,
  })
}

async function openReview(draft = goodAirFryerDraft) {
  respond(draft)
  const user = userEvent.setup()
  const onClose = vi.fn()
  render(<RecipeVersionDialog recipe={recipe} onClose={onClose} />)
  await user.click(screen.getByRole("button", { name: "Create draft" }))
  await screen.findByRole("button", { name: "Save new version" })
  return { user, onClose }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.saveRecipeVersion).mockResolvedValue(saved)
})

describe("RecipeVersionDialog", () => {
  it("offers only methods the recipe doesn't already have", () => {
    render(<RecipeVersionDialog recipe={recipe} onClose={vi.fn()} />)
    expect(screen.getByRole("radio", { name: /Oven/ })).toBeDisabled()
    expect(screen.getByRole("radio", { name: /Slow cooker/ })).toBeDisabled()
    expect(screen.getByRole("radio", { name: /Air fryer/ })).toBeChecked()
  })

  it("sends the chosen method and notes, then saves the reviewed draft", async () => {
    respond()
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<RecipeVersionDialog recipe={recipe} onClose={onClose} />)
    await user.type(screen.getByLabelText(/Anything the AI should know/), "two batches")
    await user.click(screen.getByRole("button", { name: "Create draft" }))
    expect(api.requestRecipeVersionDraft).toHaveBeenCalledWith(
      recipe.id,
      "airFryer",
      "two batches",
      expect.any(AbortSignal)
    )
    expect(await screen.findByText("All automated checks passed.")).toBeVisible()
    await user.click(screen.getByRole("button", { name: "Save new version" }))
    expect(api.saveRecipeVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        target: "airFryer",
        acceptedChanges: new Set([1]),
        existingCopy: undefined,
      })
    )
    expect(navigate).toHaveBeenCalledWith({
      to: "/recipes/$id/$slug",
      params: { id: "IiIiIiIiQiKCIiIiIiIiIg", slug: "bbq-af" },
    })
    expect(onClose).toHaveBeenCalled()
    expect(JSON.stringify(capture.mock.calls)).not.toContain("Twice-Baked")
  })

  it("shows the server's error and stays on the form", async () => {
    vi.mocked(api.requestRecipeVersionDraft).mockRejectedValue(new Error("AI isn't set up yet."))
    const user = userEvent.setup()
    render(<RecipeVersionDialog recipe={recipe} onClose={vi.fn()} />)
    await user.click(screen.getByRole("button", { name: "Create draft" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("AI isn't set up yet.")
    expect(screen.getByRole("button", { name: "Create draft" })).toBeEnabled()
  })

  it("blocks saving until a must-fix problem is fixed, re-checking after each edit", async () => {
    const { user } = await openReview({ ...goodAirFryerDraft, totalMinutes: 10 })
    expect(screen.getByText(/total time is shorter/)).toBeVisible()
    expect(screen.getByRole("button", { name: "Save new version" })).toBeDisabled()
    const total = screen.getByLabelText("Total (min)")
    await user.clear(total)
    await user.type(total, "70")
    expect(screen.queryByText(/total time is shorter/)).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save new version" })).toBeEnabled()
  })

  it("needs the warnings ticked before saving", async () => {
    const { user } = await openReview({ ...goodAirFryerDraft, confidence: "low" })
    const save = screen.getByRole("button", { name: "Save new version" })
    expect(save).toBeDisabled()
    await user.click(screen.getByLabelText("I've checked the warnings above."))
    expect(save).toBeEnabled()
  })

  it("leaves out an unticked ingredient change and stops it blocking", async () => {
    const { user } = await openReview({
      ...goodAirFryerDraft,
      ingredientChanges: [{ index: 4, quantity: 2, remove: false, reason: "More seasoning" }],
    })
    expect(screen.getByText(/has no separate amount/)).toBeVisible()
    await user.click(screen.getByRole("checkbox", { name: /salt and pepper/ }))
    expect(screen.queryByText(/has no separate amount/)).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Save new version" }))
    expect(vi.mocked(api.saveRecipeVersion).mock.calls[0][0].acceptedChanges.size).toBe(0)
  })

  it("reuses the copy after a failed update instead of duplicating again", async () => {
    vi.mocked(api.saveRecipeVersion).mockRejectedValueOnce(new api.RecipeVersionUpdateError(saved))
    const { user } = await openReview()
    await user.click(screen.getByRole("button", { name: "Save new version" }))
    expect(await screen.findByRole("alert")).toHaveTextContent(/didn't save the new method/)
    await user.click(screen.getByRole("button", { name: "Save new version" }))
    expect(vi.mocked(api.saveRecipeVersion).mock.calls[1][0].existingCopy).toEqual(saved)
  })

  it("offers to retry linking when only the link failed", async () => {
    vi.mocked(api.saveRecipeVersion).mockRejectedValueOnce(new api.RecipeVersionLinkError(saved))
    vi.mocked(api.linkOriginalToVersion).mockResolvedValue()
    const { user } = await openReview()
    await user.click(screen.getByRole("button", { name: "Save new version" }))
    await user.click(await screen.findByRole("button", { name: "Retry linking" }))
    expect(api.linkOriginalToVersion).toHaveBeenCalledWith(recipe.id, saved, "airFryer")
    expect(navigate).toHaveBeenCalled()
  })

  it("lets the cook edit and remove steps and see the original method", async () => {
    const { user } = await openReview()
    await user.click(screen.getByRole("button", { name: "Remove step 3" }))
    expect(screen.queryByLabelText("Step 3")).not.toBeInTheDocument()
    const original = screen.getByText("Original oven method").closest("details")!
    expect(within(original).getByText(/Preheat the oven to 200°C/)).toBeInTheDocument()
    expect(screen.getByText(/new method doesn't/)).toBeVisible()
    await user.click(screen.getByLabelText("I've checked the warnings above."))
    await user.click(screen.getByRole("button", { name: "Save new version" }))
    expect(vi.mocked(api.saveRecipeVersion).mock.calls[0][0].draft.steps).toHaveLength(2)
  })
})

import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { RecipeOutput } from "../api/generated/types.gen"
import * as api from "../api/recipeVersions"
import { resetUpdateHoldsForTesting, updateBlockers } from "../pwa/updateHolds"
import { goodAirFryerDraft, ovenSource } from "../test/fixtures/recipeVersionDrafts"
import { act, render, screen, within } from "../test/render"
import { RecipeVersionPage } from "./RecipeVersionPage"

const navigate = vi.fn()
const blockers: { shouldBlockFn: () => boolean }[] = []
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
  useBlocker: (options: { shouldBlockFn: () => boolean }) => {
    blockers.push(options)
  },
  Link: ({ to, children, className }: { to: string; children: ReactNode; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
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
  performTimeSeconds: 4500,
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
  const view = render(<RecipeVersionPage recipe={recipe} />)
  await user.click(screen.getByRole("button", { name: "Create draft" }))
  await screen.findByRole("button", { name: "Save new version" })
  return { user, view }
}

beforeEach(() => {
  vi.clearAllMocks()
  blockers.length = 0
  resetUpdateHoldsForTesting()
  vi.mocked(api.saveRecipeVersion).mockResolvedValue(saved)
})

describe("RecipeVersionPage", () => {
  it("offers only methods the recipe doesn't already have", () => {
    render(<RecipeVersionPage recipe={recipe} />)
    expect(screen.getByRole("radio", { name: /Oven/ })).toBeDisabled()
    expect(screen.getByRole("radio", { name: /Slow cooker/ })).toBeDisabled()
    expect(screen.getByRole("radio", { name: /Air fryer/ })).toBeChecked()
  })

  it("sends the chosen method and notes, then saves the reviewed draft", async () => {
    respond()
    const user = userEvent.setup()
    render(<RecipeVersionPage recipe={recipe} />)
    await user.type(screen.getByLabelText(/Anything the AI should know/), "two batches")
    await user.click(screen.getByRole("button", { name: "Create draft" }))
    expect(api.requestRecipeVersionDraft).toHaveBeenCalledWith(
      recipe.id,
      "airFryer",
      "two batches",
      expect.any(AbortSignal),
      expect.any(Function)
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
      replace: true,
      to: "/recipes/$id/$slug",
      params: { id: "IiIiIiIiQiKCIiIiIiIiIg", slug: "bbq-af" },
    })
    expect(JSON.stringify(capture.mock.calls)).not.toContain("Twice-Baked")
  })

  it("shows the server's error and stays on the form", async () => {
    vi.mocked(api.requestRecipeVersionDraft).mockRejectedValue(new Error("AI isn't set up yet."))
    const user = userEvent.setup()
    render(<RecipeVersionPage recipe={recipe} />)
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
    await user.click(screen.getByLabelText("I've checked the warnings"))
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
    const original = screen.getByRole("region", { name: "Original recipe" })
    expect(within(original).getByText(/Preheat the oven to 200°C/)).toBeInTheDocument()
    expect(screen.getByText(/new method doesn't/)).toBeVisible()
    await user.click(screen.getByLabelText("I've checked the warnings"))
    await user.click(screen.getByRole("button", { name: "Save new version" }))
    expect(vi.mocked(api.saveRecipeVersion).mock.calls[0][0].draft.steps).toHaveLength(2)
  })
})

describe("RecipeVersionPage comparison", () => {
  it("switches between side by side, original only and draft only", async () => {
    const { user } = await openReview()
    const original = screen.getByRole("region", { name: "Original recipe" })
    const draft = screen.getByRole("region", { name: "New version" })
    expect(screen.getByRole("button", { name: "Side by side" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    await user.click(screen.getByRole("button", { name: "Original" }))
    expect(draft).toHaveClass("hidden")
    expect(original).not.toHaveClass("hidden")
    await user.click(screen.getByRole("button", { name: "Draft" }))
    expect(original).toHaveClass("hidden")
    expect(draft).not.toHaveClass("hidden")
  })

  it("shows the original time next to a changed draft time", async () => {
    await openReview()
    expect(screen.getByText("was 75")).toBeInTheDocument()
  })

  it("goes back to the setup form to change notes before redrafting", async () => {
    const { user } = await openReview()
    await user.click(screen.getByRole("button", { name: "Start again" }))
    expect(screen.getByLabelText(/Anything the AI should know/)).toBeVisible()
    expect(screen.getByRole("link", { name: "Cancel" })).toHaveAttribute(
      "href",
      "/recipes/ETU2ihooS0ekItv506e7wA/bbq-potatoes"
    )
  })
})

describe("RecipeVersionPage leaving", () => {
  it("asks before leaving with an unsaved draft, but not after saving", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false)
    const { user } = await openReview()
    expect(blockers.at(-1)?.shouldBlockFn()).toBe(true)
    expect(confirm).toHaveBeenCalledWith("Leave without saving this draft?")
    await user.click(screen.getByRole("button", { name: "Save new version" }))
    confirm.mockClear()
    expect(blockers.at(-1)?.shouldBlockFn()).toBe(false)
    expect(confirm).not.toHaveBeenCalled()
    confirm.mockRestore()
  })

  it("doesn't ask before a draft exists", () => {
    render(<RecipeVersionPage recipe={recipe} />)
    expect(blockers.at(-1)?.shouldBlockFn()).toBe(false)
  })

  it("lists accepted new ingredients beside the original ones", async () => {
    await openReview({
      ...goodAirFryerDraft,
      newIngredients: [{ text: "spray oil", reason: "for the basket" }],
    })
    const original = screen.getByRole("region", { name: "Original recipe" })
    expect(within(original).getByText("+ spray oil")).toBeInTheDocument()
  })
})

it("says which household appliance the draft is written for", () => {
  render(<RecipeVersionPage recipe={recipe} />)
  expect(
    screen.getByText("Written for your Ninja Foodi MAX Dual Zone Air Fryer (AF400UK).")
  ).toBeInTheDocument()
})

it("shows each drafting stage as the AI works", async () => {
  let report: (event: unknown) => void = () => {}
  vi.mocked(api.requestRecipeVersionDraft).mockImplementation(
    (_id, _target, _notes, _signal, onProgress) =>
      new Promise(() => {
        report = event => onProgress?.(event as never)
      })
  )
  const user = userEvent.setup()
  render(<RecipeVersionPage recipe={recipe} />)
  await user.click(screen.getByRole("button", { name: "Create draft" }))
  const stages = screen.getByRole("list", { name: "Drafting progress" })
  expect(within(stages).getByText("Reading the recipe").closest("li")).toHaveAttribute(
    "aria-current",
    "step"
  )
  act(() =>
    report({ type: "progress", stage: "thinking", thought: "Splitting food between zones" })
  )
  expect(within(stages).getByText("Splitting food between zones")).toBeInTheDocument()
  act(() => report({ type: "progress", stage: "thinking" }))
  expect(within(stages).getByText("Splitting food between zones")).toBeInTheDocument()
  act(() => report({ type: "progress", stage: "writing", steps: 3 }))
  expect(
    within(stages)
      .getByText(/Writing the steps/)
      .closest("li")
  ).toHaveAttribute("aria-current", "step")
  expect(within(stages).getByText("· 3 so far")).toBeInTheDocument()
  expect(within(stages).queryByText("Splitting food between zones")).not.toBeInTheDocument()
  expect(screen.getByText(/Usually 20–60 seconds/)).toBeInTheDocument()
})

describe("RecipeVersionPage across reloads", () => {
  it("brings back the reviewed draft and the user's choices after a reload", async () => {
    const { user, view } = await openReview()
    const change = screen.getAllByRole("checkbox").find(box => (box as HTMLInputElement).checked)
    await user.click(change!)
    const before = screen.getAllByRole("checkbox").map(box => (box as HTMLInputElement).checked)
    view.unmount()
    render(<RecipeVersionPage recipe={recipe} />)
    expect(await screen.findByRole("button", { name: "Save new version" })).toBeVisible()
    expect(screen.getAllByRole("checkbox").map(box => (box as HTMLInputElement).checked)).toEqual(
      before
    )
    expect(api.requestRecipeVersionDraft).toHaveBeenCalledTimes(1)
  })

  it("keeps the typed notes after a reload", async () => {
    const user = userEvent.setup()
    const first = render(<RecipeVersionPage recipe={recipe} />)
    await user.type(screen.getByLabelText(/Anything the AI should know/), "two batches")
    first.unmount()
    render(<RecipeVersionPage recipe={recipe} />)
    expect(screen.getByLabelText(/Anything the AI should know/)).toHaveValue("two batches")
  })

  it("ignores a saved draft once the original recipe has changed", async () => {
    const user = userEvent.setup()
    const first = render(<RecipeVersionPage recipe={{ ...recipe, dateUpdated: "2026-10-01" }} />)
    await user.type(screen.getByLabelText(/Anything the AI should know/), "two batches")
    first.unmount()
    render(<RecipeVersionPage recipe={{ ...recipe, dateUpdated: "2026-10-02" }} />)
    expect(screen.getByLabelText(/Anything the AI should know/)).toHaveValue("")
  })

  it("forgets the draft once the new version is saved", async () => {
    const { user } = await openReview()
    await user.click(screen.getByRole("button", { name: "Save new version" }))
    expect(navigate).toHaveBeenCalled()
    expect(Object.keys(localStorage).filter(key => key.startsWith("manaaki:draft:"))).toEqual([])
  })

  it("forgets the draft when the user confirms leaving without saving", async () => {
    await openReview()
    vi.spyOn(window, "confirm").mockReturnValue(true)
    expect(blockers.at(-1)?.shouldBlockFn()).toBe(false)
    expect(Object.keys(localStorage).filter(key => key.startsWith("manaaki:draft:"))).toEqual([])
  })

  it("holds app updates while the first draft is being written", async () => {
    vi.mocked(api.requestRecipeVersionDraft).mockImplementation(() => new Promise(() => {}))
    const user = userEvent.setup()
    render(<RecipeVersionPage recipe={recipe} />)
    expect(updateBlockers("in-place")).toEqual([])
    await user.click(screen.getByRole("button", { name: "Create draft" }))
    expect(updateBlockers("in-place")).toContain("recipe-version")
  })

  it("allows an in-place update during review but holds updates on navigation", async () => {
    await openReview()
    expect(updateBlockers("in-place")).toEqual([])
    expect(updateBlockers("navigation")).toEqual(["recipe-version-draft"])
  })
})

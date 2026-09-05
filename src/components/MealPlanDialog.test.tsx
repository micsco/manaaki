import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  createOneApiHouseholdsMealplansPost,
  getAllApiHouseholdsMealplansGet,
  getAllApiRecipesGet,
  updateOneApiHouseholdsMealplansItemIdPut,
} from "../api/generated/sdk.gen"
import type { ReadPlanEntry } from "../api/generated/types.gen"
import { toIsoDateString } from "../hooks/useMealPlan"
import { render, screen, waitFor } from "../test/render"
import { MealPlanDialog } from "./MealPlanDialog"

vi.mock("../api/generated/sdk.gen", () => ({
  createOneApiHouseholdsMealplansPost: vi.fn(),
  getAllApiHouseholdsMealplansGet: vi.fn(),
  getAllApiRecipesGet: vi.fn(),
  updateOneApiHouseholdsMealplansItemIdPut: vi.fn(),
}))
const entry: ReadPlanEntry = {
  id: 12,
  groupId: "group",
  userId: "user",
  householdId: "house",
  date: "2026-09-06",
  entryType: "lunch",
  recipeId: "salad",
  title: "Salad",
  text: "Use greens first",
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getAllApiHouseholdsMealplansGet).mockResolvedValue({
    data: { items: [entry] },
  } as never)
  vi.mocked(getAllApiRecipesGet).mockResolvedValue({
    data: { items: [{ id: "salad", name: "Salad" }] },
  } as never)
  vi.mocked(createOneApiHouseholdsMealplansPost).mockResolvedValue({ data: entry } as never)
  vi.mocked(updateOneApiHouseholdsMealplansItemIdPut).mockResolvedValue({ data: entry } as never)
})
describe("MealPlanDialog", () => {
  it("adds the chosen recipe on a date and meal type while keeping existing meals", async () => {
    const user = userEvent.setup()
    const close = vi.fn()
    render(
      <MealPlanDialog
        date="2026-09-06"
        recipe={{ id: "peppers", name: "Peppers" }}
        onClose={close}
      />
    )
    expect(await screen.findByText("Salad", { exact: false })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /^Dinner$/ }))
    await user.type(screen.getByLabelText(/Planning note/), "Prep after work")
    await user.click(screen.getByRole("button", { name: "Add meal" }))
    await waitFor(() => expect(close).toHaveBeenCalled())
    expect(createOneApiHouseholdsMealplansPost).toHaveBeenCalledWith({
      body: {
        date: "2026-09-06",
        entryType: "dinner",
        recipeId: "peppers",
        title: "",
        text: "Prep after work",
      },
    })
    expect(updateOneApiHouseholdsMealplansItemIdPut).not.toHaveBeenCalled()
  })
  it("moves the original entry and retains its recipe, ownership and note", async () => {
    const user = userEvent.setup()
    render(<MealPlanDialog date={entry.date} entry={entry} onClose={vi.fn()} />)
    if (!screen.queryByLabelText("Day"))
      await user.click(screen.getByRole("button", { name: "Another date" }))
    await user.clear(screen.getByLabelText("Day"))
    await user.type(screen.getByLabelText("Day"), "2026-09-08")
    await user.click(screen.getByRole("button", { name: "Save changes" }))
    await waitFor(() => expect(updateOneApiHouseholdsMealplansItemIdPut).toHaveBeenCalled())
    expect(updateOneApiHouseholdsMealplansItemIdPut).toHaveBeenCalledWith({
      path: { item_id: 12 },
      body: {
        date: "2026-09-08",
        entryType: "lunch",
        recipeId: "salad",
        title: "Salad",
        text: "Use greens first",
        id: 12,
        groupId: "group",
        userId: "user",
      },
    })
  })
  it("retains input and allows retry after an API error", async () => {
    vi.mocked(createOneApiHouseholdsMealplansPost).mockResolvedValueOnce({
      error: { detail: "failed" },
    } as never)
    const user = userEvent.setup()
    const close = vi.fn()
    render(<MealPlanDialog date="2026-09-06" recipe={{ id: "peppers" }} onClose={close} />)
    await user.click(screen.getByRole("button", { name: "Add meal" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't save")
    if (!screen.queryByLabelText("Day"))
      await user.click(screen.getByRole("button", { name: "Another date" }))
    expect(screen.getByLabelText("Day")).toHaveValue("2026-09-06")
    expect(close).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: "Add meal" }))
    await waitFor(() => expect(close).toHaveBeenCalled())
  })
  it("creates a note without a recipe", async () => {
    const user = userEvent.setup()
    render(<MealPlanDialog date="2026-09-06" onClose={vi.fn()} />)
    await user.click(screen.getByRole("checkbox"))
    await user.type(screen.getByLabelText("Title"), "Eating out")
    await user.click(screen.getByRole("button", { name: "Add meal" }))
    await waitFor(() =>
      expect(createOneApiHouseholdsMealplansPost).toHaveBeenCalledWith({
        body: {
          date: "2026-09-06",
          entryType: "dinner",
          recipeId: null,
          title: "Eating out",
          text: "",
        },
      })
    )
  })
  it("allows selecting a recipe from the day", async () => {
    const user = userEvent.setup()
    render(<MealPlanDialog date="2026-09-06" onClose={vi.fn()} />)
    await user.click(await screen.findByRole("radio", { name: "Salad" }))
    await user.click(screen.getByRole("button", { name: "Add meal" }))
    await waitFor(() =>
      expect(createOneApiHouseholdsMealplansPost).toHaveBeenCalledWith({
        body: expect.objectContaining({ recipeId: "salad" }),
      })
    )
  })
})

it("selects a day in the next week and lunch without opening date or meal pickers", async () => {
  const user = userEvent.setup()
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  render(
    <MealPlanDialog
      date={toIsoDateString(new Date())}
      recipe={{ id: "peppers" }}
      onClose={vi.fn()}
    />
  )
  expect(screen.queryByLabelText("Day")).not.toBeInTheDocument()
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
  const label = tomorrow.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })
  await user.click(screen.getByRole("button", { name: label }))
  await user.click(screen.getByRole("button", { name: /^Lunch$/ }))
  expect(screen.getByRole("button", { name: label })).toHaveAttribute("aria-pressed", "true")
  await user.click(screen.getByRole("button", { name: "Add meal" }))
  await waitFor(() =>
    expect(createOneApiHouseholdsMealplansPost).toHaveBeenCalledWith({
      body: expect.objectContaining({ date: toIsoDateString(tomorrow), entryType: "lunch" }),
    })
  )
})
it("offers uncommon meal types without changing the selection on opening Other", async () => {
  const user = userEvent.setup()
  render(
    <MealPlanDialog
      date={toIsoDateString(new Date())}
      recipe={{ id: "peppers" }}
      onClose={vi.fn()}
    />
  )
  await user.click(screen.getByRole("button", { name: "Other" }))
  expect(screen.getByRole("button", { name: "Dinner" })).toHaveAttribute("aria-pressed", "true")
  await user.selectOptions(screen.getByLabelText("Other meal type"), "dessert")
  await user.click(screen.getByRole("button", { name: "Add meal" }))
  await waitFor(() =>
    expect(createOneApiHouseholdsMealplansPost).toHaveBeenCalledWith({
      body: expect.objectContaining({ entryType: "dessert" }),
    })
  )
})
it("preserves an existing uncommon type and a date beyond the next week", () => {
  render(
    <MealPlanDialog
      date="2030-01-01"
      entry={{ ...entry, entryType: "breakfast" }}
      onClose={vi.fn()}
    />
  )
  expect(screen.getByLabelText("Day")).toHaveValue("2030-01-01")
  expect(screen.getByLabelText("Other meal type")).toHaveValue("breakfast")
})

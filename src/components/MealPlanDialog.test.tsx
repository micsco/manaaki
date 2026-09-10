import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  createOneApiHouseholdsMealplansPost,
  deleteOneApiHouseholdsMealplansItemIdDelete,
  getAllApiHouseholdsMealplansGet,
  getAllApiRecipesGet,
  updateOneApiHouseholdsMealplansItemIdPut,
} from "../api/generated/sdk.gen"
import type { ReadPlanEntry } from "../api/generated/types.gen"
import { toIsoDateString } from "../hooks/useMealPlan"
import { render, screen, waitFor, within } from "../test/render"
import { useWeather } from "../weather/useWeather"
import { MealPlanDialog } from "./MealPlanDialog"

vi.mock("../weather/useWeather", () => ({ useWeather: vi.fn() }))

vi.mock("../api/generated/sdk.gen", () => ({
  createOneApiHouseholdsMealplansPost: vi.fn(),
  deleteOneApiHouseholdsMealplansItemIdDelete: vi.fn(),
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
  vi.mocked(deleteOneApiHouseholdsMealplansItemIdDelete).mockResolvedValue({} as never)
  vi.mocked(useWeather).mockReturnValue({
    snapshot: undefined,
    isStale: false,
    isPending: false,
    isFetching: false,
    refresh: vi.fn(),
  })
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

it("shows each day's high and planned count, and updates the selected forecast", async () => {
  const today = toIsoDateString(new Date())
  const next = new Date()
  next.setDate(next.getDate() + 1)
  const tomorrow = toIsoDateString(next)
  vi.mocked(useWeather).mockReturnValue({
    snapshot: {
      version: 1,
      fetchedAt: Date.now(),
      days: [
        { date: today, high: 21, low: 10, code: 3, rain: 20 },
        { date: tomorrow, high: 24, low: 14, code: 0, rain: 0 },
      ],
    },
    isStale: false,
    isPending: false,
    isFetching: false,
    refresh: vi.fn(),
  })
  vi.mocked(getAllApiHouseholdsMealplansGet).mockResolvedValue({
    data: {
      items: [
        { ...entry, id: 1, date: today },
        { ...entry, id: 2, date: today },
        { ...entry, id: 3, date: tomorrow },
      ],
    },
  } as never)
  render(
    <MealPlanDialog date={today} recipe={{ id: "peppers", name: "Peppers" }} onClose={vi.fn()} />
  )
  const todayButton = screen.getByRole("button", {
    name: new Date().toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }),
  })
  await waitFor(() =>
    expect(todayButton).toHaveAccessibleDescription("Cloudy · High 21° · 2 meals planned")
  )
  const tomorrowButton = screen.getByRole("button", {
    name: next.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }),
  })
  expect(tomorrowButton).toHaveAccessibleDescription("Clear · High 24° · 1 meal planned")
  expect(within(todayButton).queryByText("21°")).not.toBeInTheDocument()
  expect(within(todayButton).getByText("2", { exact: true })).toBeVisible()
  expect(screen.getByText("21°", { exact: true })).toBeVisible()
  expect(screen.queryByText("High 21°", { exact: true })).not.toBeInTheDocument()
  expect(screen.getByLabelText("Selected day weather")).toHaveTextContent("Cloudy · High 21°C")
  await userEvent.setup().click(tomorrowButton)
  expect(screen.getByLabelText("Selected day weather")).toHaveTextContent("Clear · High 24°C")
  expect(screen.queryByText(/Low /)).not.toBeInTheDocument()
})
it("keeps dates selectable without weather or existing meals", async () => {
  vi.mocked(getAllApiHouseholdsMealplansGet).mockResolvedValue({ data: { items: [] } } as never)
  render(
    <MealPlanDialog
      date={toIsoDateString(new Date())}
      recipe={{ id: "peppers" }}
      onClose={vi.fn()}
    />
  )
  expect(screen.getByLabelText("Selected day weather")).toHaveTextContent("Forecast unavailable")
  expect(await screen.findByText("No other meals planned.")).toBeVisible()
  expect(screen.queryByText(/\d+ meals? planned/)).not.toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Add meal" })).toBeEnabled()
})

describe("meal removal", () => {
  it("does not offer removal when adding a meal", () => {
    render(<MealPlanDialog date={entry.date} onClose={vi.fn()} />)
    expect(screen.queryByRole("button", { name: "Remove from plan" })).not.toBeInTheDocument()
  })

  it("confirms the saved meal and date and lets the user keep their edits", async () => {
    const user = userEvent.setup()
    render(<MealPlanDialog date={entry.date} entry={entry} onClose={vi.fn()} />)
    await user.type(screen.getByLabelText(/Planning note/), " tomorrow")
    if (!screen.queryByLabelText("Day"))
      await user.click(screen.getByRole("button", { name: "Another date" }))
    await user.clear(screen.getByLabelText("Day"))
    await user.type(screen.getByLabelText("Day"), "2026-09-08")
    await user.click(screen.getByRole("button", { name: "Remove from plan" }))
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Remove planned meal?")
    expect(screen.getByRole("button", { name: "Keep meal" })).toHaveFocus()
    expect(screen.getByRole("dialog")).toHaveAccessibleDescription(
      "Salad · Sunday 6 September · lunch"
    )
    expect(deleteOneApiHouseholdsMealplansItemIdDelete).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: "Keep meal" }))
    expect(screen.getByLabelText(/Planning note/)).toHaveValue("Use greens first tomorrow")
    expect(screen.getByLabelText("Day")).toHaveValue("2026-09-08")
    expect(deleteOneApiHouseholdsMealplansItemIdDelete).not.toHaveBeenCalled()
  })

  it.each([entry, { ...entry, recipeId: null, title: "Eating out" }])(
    "removes only the confirmed entry and refreshes the plan: $title",
    async plannedMeal => {
      const user = userEvent.setup()
      const close = vi.fn()
      render(<MealPlanDialog date={entry.date} entry={plannedMeal} onClose={close} />)
      await screen.findByText("No other meals planned.")
      await user.click(screen.getByRole("button", { name: "Remove from plan" }))
      vi.mocked(getAllApiHouseholdsMealplansGet).mockClear()
      await user.click(screen.getByRole("button", { name: "Confirm removal" }))
      await waitFor(() => expect(close).toHaveBeenCalledOnce())
      expect(deleteOneApiHouseholdsMealplansItemIdDelete).toHaveBeenCalledExactlyOnceWith({
        path: { item_id: 12 },
      })
      expect(getAllApiHouseholdsMealplansGet).toHaveBeenCalled()
      expect(updateOneApiHouseholdsMealplansItemIdPut).not.toHaveBeenCalled()
      expect(createOneApiHouseholdsMealplansPost).not.toHaveBeenCalled()
    }
  )

  it.each(["api", "network"])("allows retry after a %s failure", async failure => {
    if (failure === "api") {
      vi.mocked(deleteOneApiHouseholdsMealplansItemIdDelete).mockResolvedValueOnce({
        error: { detail: "failed" },
      } as never)
    } else {
      vi.mocked(deleteOneApiHouseholdsMealplansItemIdDelete).mockRejectedValueOnce(
        new Error("Offline")
      )
    }
    const user = userEvent.setup()
    const close = vi.fn()
    render(<MealPlanDialog date={entry.date} entry={entry} onClose={close} />)
    await user.click(screen.getByRole("button", { name: "Remove from plan" }))
    await user.click(screen.getByRole("button", { name: "Confirm removal" }))
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't remove this meal. Please try again."
    )
    expect(close).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: "Confirm removal" }))
    await waitFor(() => expect(close).toHaveBeenCalledOnce())
  })

  it("blocks duplicate removal and dismissal while the request is pending", async () => {
    let finish!: (value: never) => void
    vi.mocked(deleteOneApiHouseholdsMealplansItemIdDelete).mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve
        }) as never
    )
    const user = userEvent.setup()
    const close = vi.fn()
    render(<MealPlanDialog date={entry.date} entry={entry} onClose={close} />)
    await user.click(screen.getByRole("button", { name: "Remove from plan" }))
    await user.dblClick(screen.getByRole("button", { name: "Confirm removal" }))
    expect(screen.getByRole("button", { name: "Removing…" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Keep meal" })).toBeDisabled()
    await user.keyboard("{Escape}")
    expect(close).not.toHaveBeenCalled()
    expect(deleteOneApiHouseholdsMealplansItemIdDelete).toHaveBeenCalledOnce()
    finish({} as never)
    await waitFor(() => expect(close).toHaveBeenCalledOnce())
  })
})

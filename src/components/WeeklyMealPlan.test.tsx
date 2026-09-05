import userEvent from "@testing-library/user-event"
import { NuqsTestingAdapter } from "nuqs/adapters/testing"
import { beforeEach, expect, it, vi } from "vitest"

import { getAllApiHouseholdsMealplansGet } from "../api/generated/sdk.gen"
import { todayIsoDateString } from "../hooks/useMealPlan"
import { render, screen, waitFor, within } from "../test/render"
import { WeeklyMealPlan } from "./WeeklyMealPlan"

vi.mock("../api/generated/sdk.gen", () => ({ getAllApiHouseholdsMealplansGet: vi.fn() }))
vi.mock("./MealPlanDialog", () => ({
  mealTypes: ["breakfast", "lunch", "dinner", "side", "snack", "drink", "dessert"],
  MealPlanDialog: ({ date }: { date: string }) => <div role="dialog">{date}</div>,
}))
vi.mock("./BuildShoppingListDialog", () => ({
  BuildShoppingListDialog: ({ onClose }: { onClose: () => void }) => (
    <div role="dialog" aria-label="Build shopping list">
      <button onClick={onClose}>Cancel</button>
    </div>
  ),
}))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, params, search, ...props }: any) => (
    <a
      href={params ? `/recipes/${params.id}/${params.slug}${search?.cook ? "?cook=true" : ""}` : to}
      {...props}
    >
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
}))
beforeEach(() => {})
it("shows every meal type, multiple dinners, images and recipe-free notes", async () => {
  const date = todayIsoDateString()
  vi.mocked(getAllApiHouseholdsMealplansGet).mockResolvedValue({
    data: {
      items: [
        {
          id: 1,
          date,
          entryType: "dinner",
          recipe: {
            id: "11111111-1111-4111-8111-111111111111",
            slug: "salad",
            name: "Salad",
            image: "123",
            totalTime: "30 minutes",
            tags: [{ name: "Air fryer" }],
            tools: [{ name: "Slow cooker" }],
          },
        },
        { id: 2, date, entryType: "dinner", title: "Soup" },
        { id: 3, date, entryType: "breakfast", title: "Toast", text: "Early start" },
      ],
    },
  } as never)
  const user = userEvent.setup()
  render(
    <NuqsTestingAdapter hasMemory>
      <WeeklyMealPlan />
    </NuqsTestingAdapter>
  )
  expect(await screen.findByRole("heading", { name: "Salad" })).toBeInTheDocument()
  expect(screen.getByRole("heading", { name: "Soup" })).toBeInTheDocument()
  expect(screen.getByRole("heading", { name: "Toast" })).toBeInTheDocument()
  expect(screen.getByText("Early start")).toBeInTheDocument()
  expect(screen.getAllByRole("button", { name: /^Add meal for / })).toHaveLength(6)
  const salad = within(screen.getByRole("heading", { name: "Salad" }).closest("article")!)
  expect(salad.getByText("30m")).toBeInTheDocument()
  expect(salad.getByText("Air fryer")).toBeInTheDocument()
  expect(salad.getByText("Slow cooker")).toBeInTheDocument()
  expect(
    within(screen.getByRole("link", { name: /^dinner salad$/i })).getByRole("presentation")
  ).toHaveAttribute("src", expect.stringContaining("min-original"))
  expect(
    within(screen.getByRole("link", { name: /^dinner salad$/i })).queryByRole("button")
  ).not.toBeInTheDocument()
  expect(salad.getByRole("link", { name: "Cook Salad" })).toHaveAttribute(
    "href",
    expect.stringContaining("?cook=true")
  )
  const edit = salad.getByRole("button", { name: "Adjust plan for Salad" })
  expect(edit).toHaveAttribute("title", "Adjust plan: change date, meal type or note")
  expect(edit).toHaveTextContent("")
  edit.focus()
  expect(edit).toHaveFocus()
  await user.keyboard("{Enter}")
  expect(screen.getByRole("dialog")).toHaveTextContent(date)
})
it("offers recovery when the plan fails to load", async () => {
  vi.mocked(getAllApiHouseholdsMealplansGet).mockResolvedValue({ error: {} } as never)
  render(
    <NuqsTestingAdapter hasMemory>
      <WeeklyMealPlan />
    </NuqsTestingAdapter>
  )
  expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load")
  expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument()
})
it("navigates weeks without leaving previous entries under new dates", async () => {
  vi.mocked(getAllApiHouseholdsMealplansGet).mockResolvedValue({ data: { items: [] } } as never)
  const user = userEvent.setup()
  render(
    <NuqsTestingAdapter hasMemory>
      <WeeklyMealPlan />
    </NuqsTestingAdapter>
  )
  await screen.findAllByText("Nothing planned yet.")
  expect(screen.queryByLabelText("Start date")).not.toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Choose another date…" }))
  const original = todayIsoDateString()
  await user.click(screen.getByRole("button", { name: "Next week" }))
  await waitFor(() => expect(screen.getByLabelText("Start date")).not.toHaveValue(original))
  await user.click(screen.getByRole("button", { name: "Back to today" }))
  await waitFor(() => expect(screen.getByLabelText("Start date")).toHaveValue(original))
})
it("keeps a dated add action available on every empty day", async () => {
  vi.mocked(getAllApiHouseholdsMealplansGet).mockResolvedValue({ data: { items: [] } } as never)
  const user = userEvent.setup()
  render(
    <NuqsTestingAdapter hasMemory>
      <WeeklyMealPlan />
    </NuqsTestingAdapter>
  )
  const actions = await screen.findAllByRole("button", { name: /^Add meal for / })
  expect(actions).toHaveLength(7)
  const regions = screen.getAllByRole("region")
  expect(regions).toHaveLength(7)
  for (const region of regions) {
    expect(within(region).getByRole("button", { name: /^Add meal for / })).toBeInTheDocument()
  }
  await user.click(actions[6])
  const date = new Date(`${todayIsoDateString()}T00:00:00`)
  date.setDate(date.getDate() + 6)
  expect(screen.getByRole("dialog")).toHaveTextContent(
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
  )
})

it("opens and closes shopping from the page action outside date navigation", async () => {
  vi.mocked(getAllApiHouseholdsMealplansGet).mockResolvedValue({ data: { items: [] } } as never)
  const user = userEvent.setup()
  render(
    <NuqsTestingAdapter hasMemory>
      <WeeklyMealPlan />
    </NuqsTestingAdapter>
  )
  expect(screen.getByRole("button", { name: "Build shopping list" })).toBeInTheDocument()
  const dates = screen.getByRole("group", { name: "Choose dates" })

  expect(within(dates).getByRole("button", { name: "Next week" })).toBeInTheDocument()
  expect(within(dates).queryByLabelText("Start date")).not.toBeInTheDocument()
  expect(
    within(dates).queryByRole("button", { name: "Build shopping list" })
  ).not.toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Build shopping list" }))
  expect(screen.getByRole("dialog", { name: "Build shopping list" })).toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Cancel" }))
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
})

it("loads recent meals on demand and adjusts the original planned date", async () => {
  const date = new Date(`${todayIsoDateString()}T00:00:00`)
  date.setDate(date.getDate() - 2)
  const previous = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
  vi.mocked(getAllApiHouseholdsMealplansGet).mockResolvedValue({
    data: { items: [{ id: 12, date: previous, title: "Leftover curry", entryType: "dinner" }] },
  } as never)
  const user = userEvent.setup()
  render(
    <NuqsTestingAdapter hasMemory>
      <WeeklyMealPlan />
    </NuqsTestingAdapter>
  )
  await screen.findAllByText("Nothing planned yet.")
  expect(screen.queryByRole("heading", { name: "Leftover curry" })).not.toBeInTheDocument()
  expect(getAllApiHouseholdsMealplansGet).toHaveBeenCalledTimes(1)
  await user.click(screen.getByRole("button", { name: /Recent meals/ }))
  expect(await screen.findByRole("heading", { name: "Leftover curry" })).toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Adjust plan for Leftover curry" }))
  expect(screen.getByRole("dialog")).toHaveTextContent(previous)
})
it("shows a useful empty state for recent meals", async () => {
  vi.mocked(getAllApiHouseholdsMealplansGet).mockResolvedValue({ data: { items: [] } } as never)
  const user = userEvent.setup()
  render(
    <NuqsTestingAdapter hasMemory>
      <WeeklyMealPlan />
    </NuqsTestingAdapter>
  )
  await user.click(screen.getByRole("button", { name: /Recent meals/ }))
  expect(
    await screen.findByText("No meals planned in the previous seven days.")
  ).toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: /Recent meals/ }))
  expect(screen.queryByText("No meals planned in the previous seven days.")).not.toBeInTheDocument()
})

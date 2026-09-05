import userEvent from "@testing-library/user-event"
import { beforeEach, expect, it, vi } from "vitest"

import { getAllApiHouseholdsMealplansGet } from "../api/generated/sdk.gen"
import { todayIsoDateString } from "../hooks/useMealPlan"
import { render, screen, within } from "../test/render"
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
  Link: ({ to, children, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
}))
beforeEach(() => {
  vi.clearAllMocks()
})
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
          },
        },
        { id: 2, date, entryType: "dinner", title: "Soup" },
        { id: 3, date, entryType: "breakfast", title: "Toast", text: "Early start" },
      ],
    },
  } as never)
  const user = userEvent.setup()
  render(<WeeklyMealPlan />)
  expect(await screen.findByRole("heading", { name: "Salad" })).toBeInTheDocument()
  expect(screen.getByRole("heading", { name: "Soup" })).toBeInTheDocument()
  expect(screen.getByRole("heading", { name: "Toast" })).toBeInTheDocument()
  expect(screen.getByText("Early start")).toBeInTheDocument()
  expect(
    within(screen.getByRole("link", { name: /Salad/ })).getByRole("presentation")
  ).toHaveAttribute("src", expect.stringContaining("min-original"))
  await user.click(screen.getByRole("button", { name: "Edit Salad" }))
  expect(screen.getByRole("dialog")).toHaveTextContent(date)
})
it("offers recovery when the plan fails to load", async () => {
  vi.mocked(getAllApiHouseholdsMealplansGet).mockResolvedValue({ error: {} } as never)
  render(<WeeklyMealPlan />)
  expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load")
  expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument()
})
it("navigates weeks without leaving previous entries under new dates", async () => {
  vi.mocked(getAllApiHouseholdsMealplansGet).mockResolvedValue({ data: { items: [] } } as never)
  const user = userEvent.setup()
  render(<WeeklyMealPlan />)
  await screen.findAllByText("Nothing planned yet.")
  const original = screen.getByLabelText("Start date").getAttribute("value")
  await user.click(screen.getByRole("button", { name: "Next week" }))
  expect(screen.getByLabelText("Start date")).not.toHaveValue(original)
  await user.click(screen.getByRole("button", { name: /^Today$/ }))
  expect(screen.getByLabelText("Start date")).toHaveValue(original)
})
it("keeps a dated add action available on every empty day", async () => {
  vi.mocked(getAllApiHouseholdsMealplansGet).mockResolvedValue({ data: { items: [] } } as never)
  const user = userEvent.setup()
  render(<WeeklyMealPlan />)
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
  render(<WeeklyMealPlan />)
  const dates = screen.getByRole("group", { name: "Choose dates" })
  expect(within(dates).getByRole("button", { name: "Previous week" })).toBeInTheDocument()
  expect(within(dates).getByRole("button", { name: "Next week" })).toBeInTheDocument()
  expect(within(dates).getByLabelText("Start date")).toHaveValue(todayIsoDateString())
  expect(
    within(dates).queryByRole("button", { name: "Build shopping list" })
  ).not.toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Build shopping list" }))
  expect(screen.getByRole("dialog", { name: "Build shopping list" })).toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Cancel" }))
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
})

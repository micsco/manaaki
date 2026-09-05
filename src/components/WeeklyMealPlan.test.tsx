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
vi.mock("./BuildShoppingListDialog", () => ({ BuildShoppingListDialog: () => null }))
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
  const original = screen.getByLabelText("From").getAttribute("value")
  await user.click(screen.getByRole("button", { name: "Next week" }))
  expect(screen.getByLabelText("From")).not.toHaveValue(original)
  await user.click(screen.getByRole("button", { name: /^Today$/ }))
  expect(screen.getByLabelText("From")).toHaveValue(original)
})

import userEvent from "@testing-library/user-event"
import { expect, it, vi } from "vitest"

import { useCurrentUser } from "../hooks/useCurrentUser"
import { render, screen } from "../test/render"
import { AddToMealPlanButton } from "./AddToMealPlanButton"

vi.mock("../hooks/useCurrentUser", () => ({ useCurrentUser: vi.fn() }))
vi.mock("./MealPlanDialog", () => ({
  MealPlanDialog: ({ onClose }: { onClose: () => void }) => (
    <div role="dialog">
      Choose a day<button onClick={onClose}>Close plan</button>
    </div>
  ),
}))
it("opens dated planning for a signed-in recipe reader", async () => {
  vi.mocked(useCurrentUser).mockReturnValue({ user: null, isAnonymous: false })
  render(<AddToMealPlanButton recipe={{ id: "salad" }} />)
  await userEvent.setup().click(screen.getByRole("button", { name: "Add to meal plan" }))
  expect(await screen.findByText("Choose a day")).toBeInTheDocument()
})
it("does not offer a write action to anonymous readers", () => {
  vi.mocked(useCurrentUser).mockReturnValue({ user: null, isAnonymous: true })
  render(<AddToMealPlanButton recipe={{ id: "salad" }} />)
  expect(screen.queryByRole("button")).not.toBeInTheDocument()
})
it("reopens planning for the same recipe after a reload until it is closed", async () => {
  vi.mocked(useCurrentUser).mockReturnValue({ user: null, isAnonymous: false })
  const user = userEvent.setup()
  const first = render(<AddToMealPlanButton recipe={{ id: "salad" }} />)
  await user.click(screen.getByRole("button", { name: "Add to meal plan" }))
  await screen.findByText("Choose a day")
  first.unmount()
  const second = render(<AddToMealPlanButton recipe={{ id: "salad" }} />)
  expect(await screen.findByText("Choose a day")).toBeInTheDocument()
  second.unmount()
  const other = render(<AddToMealPlanButton recipe={{ id: "soup" }} />)
  expect(screen.queryByText("Choose a day")).not.toBeInTheDocument()
  other.unmount()
  render(<AddToMealPlanButton recipe={{ id: "salad" }} />)
  await user.click(await screen.findByRole("button", { name: "Close plan" }))
  expect(screen.queryByText("Choose a day")).not.toBeInTheDocument()
  expect(localStorage.getItem("manaaki:draft:v1:meal-plan:open:recipe:salad")).toBeNull()
})

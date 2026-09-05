import userEvent from "@testing-library/user-event"
import { expect, it, vi } from "vitest"

import { useCurrentUser } from "../hooks/useCurrentUser"
import { render, screen } from "../test/render"
import { AddToMealPlanButton } from "./AddToMealPlanButton"

vi.mock("../hooks/useCurrentUser", () => ({ useCurrentUser: vi.fn() }))
vi.mock("./MealPlanDialog", () => ({ MealPlanDialog: () => <div role="dialog">Choose a day</div> }))
it("opens dated planning for a signed-in recipe reader", async () => {
  vi.mocked(useCurrentUser).mockReturnValue({ user: null, isAnonymous: false })
  render(<AddToMealPlanButton recipe={{ id: "salad" }} />)
  await userEvent.setup().click(screen.getByRole("button", { name: "Add to meal plan" }))
  expect(screen.getByRole("dialog")).toBeInTheDocument()
})
it("does not offer a write action to anonymous readers", () => {
  vi.mocked(useCurrentUser).mockReturnValue({ user: null, isAnonymous: true })
  render(<AddToMealPlanButton recipe={{ id: "salad" }} />)
  expect(screen.queryByRole("button")).not.toBeInTheDocument()
})

import userEvent from "@testing-library/user-event"
import { beforeEach, expect, it, vi } from "vitest"

import { render, screen, within } from "../test/render"
import { RecipeFilterDrawer } from "./RecipeFilterDrawer"

const capture = vi.fn()
vi.mock("../contexts/AnalyticsContext", () => ({ usePostHog: () => ({ capture }) }))

function renderDrawer(overrides: Partial<Parameters<typeof RecipeFilterDrawer>[0]> = {}) {
  const props = {
    open: true,
    onOpenChange: vi.fn(),
    proteins: [],
    onToggleProtein: vi.fn(),
    tools: [],
    onToggleTool: vi.fn(),
    time: null,
    onSetTime: vi.fn(),
    handsOn: null,
    onSetHandsOn: vi.fn(),
    activeFilterCount: 0,
    onClearAll: vi.fn(),
    ...overrides,
  }
  render(<RecipeFilterDrawer {...props} />)
  return props
}

beforeEach(() => capture.mockClear())

it("filters by hands-on time separately from ready-in time", async () => {
  const user = userEvent.setup()
  const props = renderDrawer()
  await user.click(
    within(screen.getByRole("radiogroup", { name: "Hands-on" })).getByRole("radio", {
      name: "Under 15m",
    })
  )
  expect(props.onSetHandsOn).toHaveBeenCalledWith("under15")
  expect(props.onSetTime).not.toHaveBeenCalled()
  expect(capture).toHaveBeenCalledWith(
    "hands_on_filter_changed",
    expect.objectContaining({ time_bucket: "under15" })
  )
})

it("clears a hands-on bucket when it is chosen again", async () => {
  const user = userEvent.setup()
  const props = renderDrawer({ handsOn: "15to30" })
  const option = within(screen.getByRole("radiogroup", { name: "Hands-on" })).getByRole("radio", {
    name: "15–30m",
  })
  expect(option).toHaveAttribute("aria-checked", "true")
  await user.click(option)
  expect(props.onSetHandsOn).toHaveBeenCalledWith(null)
})

it("keeps the ready-in filter on total time", async () => {
  const user = userEvent.setup()
  const props = renderDrawer()
  await user.click(
    within(screen.getByRole("radiogroup", { name: "Ready in" })).getByRole("radio", {
      name: "Under 30m",
    })
  )
  expect(props.onSetTime).toHaveBeenCalledWith("under30")
})

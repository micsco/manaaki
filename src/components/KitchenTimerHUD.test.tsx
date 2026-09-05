import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { useTimer } from "../contexts/TimerContext"
import { render, screen } from "../test/render"
import { KitchenTimerHUD } from "./KitchenTimerHUD"

function TestHarness() {
  const { startTimer } = useTimer()

  return (
    <div>
      <button
        type="button"
        onClick={() =>
          startTimer({
            id: "timer-simmer",
            label: "Step 1: Simmer sauce",
            totalSeconds: 300,
          })
        }
      >
        Start Simmer
      </button>
      <KitchenTimerHUD />
    </div>
  )
}

describe("KitchenTimerHUD", () => {
  it("renders nothing when no timers are active", () => {
    const { container } = render(<KitchenTimerHUD />)
    expect(container.firstChild).toBeNull()
  })

  it("renders active timer card when timer starts", async () => {
    const user = userEvent.setup()
    render(<TestHarness />)

    await user.click(screen.getByRole("button", { name: "Start Simmer" }))

    expect(screen.getByRole("region", { name: "Timer: Step 1: Simmer sauce" })).toBeInTheDocument()
    expect(screen.getByText("Step 1: Simmer sauce")).toBeInTheDocument()
    expect(screen.getByText("05:00")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Pause timer Step 1: Simmer sauce" })
    ).toBeInTheDocument()
  })

  it("pauses and resumes timer from HUD controls", async () => {
    const user = userEvent.setup()
    render(<TestHarness />)

    await user.click(screen.getByRole("button", { name: "Start Simmer" }))

    const pauseButton = screen.getByRole("button", {
      name: "Pause timer Step 1: Simmer sauce",
    })
    await user.click(pauseButton)

    expect(screen.getByText("Paused")).toBeInTheDocument()

    const resumeButton = screen.getByRole("button", {
      name: "Resume timer Step 1: Simmer sauce",
    })
    await user.click(resumeButton)

    expect(screen.queryByText("Paused")).not.toBeInTheDocument()
  })

  it("adds one minute to timer", async () => {
    const user = userEvent.setup()
    render(<TestHarness />)

    await user.click(screen.getByRole("button", { name: "Start Simmer" }))

    const addMinuteButton = screen.getByRole("button", {
      name: "Add one minute to timer Step 1: Simmer sauce",
    })
    await user.click(addMinuteButton)

    expect(screen.getByText("06:00")).toBeInTheDocument()
  })

  it("dismisses timer when close button is clicked", async () => {
    const user = userEvent.setup()
    render(<TestHarness />)

    await user.click(screen.getByRole("button", { name: "Start Simmer" }))

    const dismissButton = screen.getByRole("button", {
      name: "Dismiss timer Step 1: Simmer sauce",
    })
    await user.click(dismissButton)

    expect(screen.queryByText("Step 1: Simmer sauce")).not.toBeInTheDocument()
  })
})

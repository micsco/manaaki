import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { render, screen } from "../test/render"
import { StepTimerChip } from "./StepTimerChip"

describe("StepTimerChip", () => {
  it("renders idle chip with raw duration text and start aria label", () => {
    render(
      <StepTimerChip
        timerId="timer-1"
        recipeId="recipe-1"
        stepIndex={0}
        label="Step 1"
        rawDurationText="15 mins"
        seconds={900}
      />
    )

    const button = screen.getByRole("button", {
      name: "Start timer for 15 mins",
    })
    expect(button).toBeInTheDocument()
    expect(button).toHaveTextContent("15 mins")
  })

  it("transitions to running state when clicked", async () => {
    const user = userEvent.setup()

    render(
      <StepTimerChip
        timerId="timer-1"
        recipeId="recipe-1"
        stepIndex={0}
        label="Step 1"
        rawDurationText="15 mins"
        seconds={900}
      />
    )

    const button = screen.getByRole("button", {
      name: "Start timer for 15 mins",
    })
    await user.click(button)

    expect(screen.getByRole("button", { name: /timer running/i })).toBeInTheDocument()
    expect(screen.getByText("15:00")).toBeInTheDocument()
  })

  it("pauses running timer on second click", async () => {
    const user = userEvent.setup()

    render(
      <StepTimerChip
        timerId="timer-1"
        recipeId="recipe-1"
        stepIndex={0}
        label="Step 1"
        rawDurationText="15 mins"
        seconds={900}
      />
    )

    await user.click(screen.getByRole("button", { name: "Start timer for 15 mins" }))

    const runningButton = screen.getByRole("button", {
      name: /timer running/i,
    })
    await user.click(runningButton)

    expect(screen.getByRole("button", { name: /timer paused/i })).toBeInTheDocument()
  })

  it("resumes paused timer on third click", async () => {
    const user = userEvent.setup()

    render(
      <StepTimerChip
        timerId="timer-1"
        recipeId="recipe-1"
        stepIndex={0}
        label="Step 1"
        rawDurationText="15 mins"
        seconds={900}
      />
    )

    await user.click(screen.getByRole("button", { name: "Start timer for 15 mins" }))
    await user.click(screen.getByRole("button", { name: /timer running/i }))
    await user.click(screen.getByRole("button", { name: /timer paused/i }))

    expect(screen.getByRole("button", { name: /timer running/i })).toBeInTheDocument()
  })

  it("prevents click propagation to parent containers", async () => {
    const user = userEvent.setup()
    const parentClick = vi.fn()

    render(
      <div onClick={parentClick} role="presentation">
        <StepTimerChip
          timerId="timer-1"
          recipeId="recipe-1"
          stepIndex={0}
          label="Step 1"
          rawDurationText="10 mins"
          seconds={600}
        />
      </div>
    )

    await user.click(screen.getByRole("button", { name: "Start timer for 10 mins" }))

    expect(parentClick).not.toHaveBeenCalled()
  })
})

import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { render, screen } from "../test/render"
import { buildWeekDays, MealPlanDayStrip } from "./MealPlanDayStrip"

describe("buildWeekDays", () => {
  it("returns 7 days starting from the given date", () => {
    const days = buildWeekDays("2024-02-19", "2024-02-25")
    expect(days).toHaveLength(7)
    expect(days[0].isoDate).toBe("2024-02-19")
    expect(days[6].isoDate).toBe("2024-02-25")
  })

  it("marks today correctly", () => {
    const days = buildWeekDays("2024-02-19", "2024-02-21")
    const today = days.find(d => d.isToday)
    expect(today?.isoDate).toBe("2024-02-21")
    expect(days.filter(d => d.isToday)).toHaveLength(1)
  })

  it("has correct day abbreviations", () => {
    const days = buildWeekDays("2024-02-19", "9999-01-01")
    expect(days[0].dayAbbrev).toBe("Mon")
    expect(days[1].dayAbbrev).toBe("Tue")
    expect(days[6].dayAbbrev).toBe("Sun")
  })

  it("has correct day numbers", () => {
    const days = buildWeekDays("2024-02-19", "9999-01-01")
    expect(days[0].dayNumber).toBe(19)
    expect(days[6].dayNumber).toBe(25)
  })
})

describe("MealPlanDayStrip", () => {
  const defaultProps = {
    startDate: "2024-02-19",
    todayIso: "2024-02-21",
    selectedDay: "2024-02-21",
    onSelectDay: vi.fn(),
  }

  it("renders 7 day buttons", () => {
    render(<MealPlanDayStrip {...defaultProps} />)
    expect(screen.getAllByRole("tab")).toHaveLength(7)
  })

  it("marks the selected day as aria-selected", () => {
    render(<MealPlanDayStrip {...defaultProps} selectedDay="2024-02-22" />)
    const tabs = screen.getAllByRole("tab")
    const selectedTab = tabs.find(t => t.getAttribute("aria-selected") === "true")
    expect(selectedTab?.getAttribute("aria-label")).toBe("2024-02-22")
  })

  it("calls onSelectDay with the correct date when a day is clicked", async () => {
    const user = userEvent.setup()
    const onSelectDay = vi.fn()
    render(<MealPlanDayStrip {...defaultProps} onSelectDay={onSelectDay} />)
    const tabs = screen.getAllByRole("tab")
    await user.click(tabs[2])
    expect(onSelectDay).toHaveBeenCalledWith("2024-02-21")
  })
})

import { describe, expect, it } from "vitest"
import { isoWeekBounds, toIsoDateString } from "./useMealPlan"

describe("toIsoDateString", () => {
  it("formats a date as YYYY-MM-DD", () => {
    expect(toIsoDateString(new Date(2024, 0, 5))).toBe("2024-01-05")
    expect(toIsoDateString(new Date(2024, 11, 31))).toBe("2024-12-31")
  })

  it("pads single-digit months and days", () => {
    expect(toIsoDateString(new Date(2024, 1, 3))).toBe("2024-02-03")
  })
})

describe("isoWeekBounds", () => {
  it("returns Monday as startDate and Sunday as endDate for offset 0", () => {
    const _mondayDate = new Date(2024, 0, 8)
    const _sundayDate = new Date(2024, 0, 14)

    const { startDate, endDate } = isoWeekBounds(0)

    expect(startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)

    const start = new Date(`${startDate}T00:00:00`)
    const end = new Date(`${endDate}T00:00:00`)
    expect(end.getTime() - start.getTime()).toBe(6 * 24 * 60 * 60 * 1000)
    expect(start.getDay()).toBe(1)
    expect(end.getDay()).toBe(0)
  })

  it("advances 7 days per positive offset", () => {
    const { startDate: start0 } = isoWeekBounds(0)
    const { startDate: start1 } = isoWeekBounds(1)

    const d0 = new Date(`${start0}T00:00:00`)
    const d1 = new Date(`${start1}T00:00:00`)
    expect(d1.getTime() - d0.getTime()).toBe(7 * 24 * 60 * 60 * 1000)
  })

  it("moves back 7 days for negative offset", () => {
    const { startDate: start0 } = isoWeekBounds(0)
    const { startDate: startMinus1 } = isoWeekBounds(-1)

    const d0 = new Date(`${start0}T00:00:00`)
    const dMinus1 = new Date(`${startMinus1}T00:00:00`)
    expect(d0.getTime() - dMinus1.getTime()).toBe(7 * 24 * 60 * 60 * 1000)
  })

  it("startDate is always a Monday (day 1)", () => {
    for (const offset of [-2, -1, 0, 1, 2]) {
      const { startDate } = isoWeekBounds(offset)
      const d = new Date(`${startDate}T00:00:00`)
      expect(d.getDay()).toBe(1)
    }
  })

  it("endDate is always a Sunday (day 0)", () => {
    for (const offset of [-2, -1, 0, 1, 2]) {
      const { endDate } = isoWeekBounds(offset)
      const d = new Date(`${endDate}T00:00:00`)
      expect(d.getDay()).toBe(0)
    }
  })
})

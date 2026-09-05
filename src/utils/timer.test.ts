import { describe, expect, it } from "vitest"

import { formatTimerDisplay, parseDurationToSeconds, parseStepSegments } from "./timer"

describe("parseDurationToSeconds", () => {
  it("parses single minute values", () => {
    expect(parseDurationToSeconds("15 mins")).toBe(900)
    expect(parseDurationToSeconds("1 minute")).toBe(60)
    expect(parseDurationToSeconds("20 minutes")).toBe(1200)
    expect(parseDurationToSeconds("5 min")).toBe(300)
    expect(parseDurationToSeconds("45m")).toBe(2700)
  })

  it("parses minute ranges by taking lower bound", () => {
    expect(parseDurationToSeconds("20-25 minutes")).toBe(1200)
    expect(parseDurationToSeconds("10–15 mins")).toBe(600)
    expect(parseDurationToSeconds("2 to 3 min")).toBe(120)
  })

  it("parses single hour values", () => {
    expect(parseDurationToSeconds("1 hour")).toBe(3600)
    expect(parseDurationToSeconds("2 hours")).toBe(7200)
    expect(parseDurationToSeconds("1.5 hours")).toBe(5400)
    expect(parseDurationToSeconds("3 hrs")).toBe(10800)
  })

  it("parses hour ranges by taking lower bound", () => {
    expect(parseDurationToSeconds("1-2 hours")).toBe(3600)
    expect(parseDurationToSeconds("6–8 hrs")).toBe(21600)
  })

  it("parses compound hours and minutes", () => {
    expect(parseDurationToSeconds("1 hour 30 mins")).toBe(5400)
    expect(parseDurationToSeconds("2 hrs 15 minutes")).toBe(8100)
    expect(parseDurationToSeconds("1h 20m")).toBe(4800)
  })

  it("parses seconds", () => {
    expect(parseDurationToSeconds("30 seconds")).toBe(30)
    expect(parseDurationToSeconds("45 secs")).toBe(45)
    expect(parseDurationToSeconds("15-20 secs")).toBe(15)
    expect(parseDurationToSeconds("10s")).toBe(10)
  })

  it("returns null for non-duration strings", () => {
    expect(parseDurationToSeconds("200g")).toBeNull()
    expect(parseDurationToSeconds("1 tbsp")).toBeNull()
    expect(parseDurationToSeconds("500ml")).toBeNull()
    expect(parseDurationToSeconds("180°C")).toBeNull()
  })
})

describe("parseStepSegments", () => {
  it("returns empty array for empty string", () => {
    expect(parseStepSegments("")).toEqual([])
  })

  it("returns single text segment when no durations exist", () => {
    const text = "Whisk the flour and baking powder together in a bowl."
    expect(parseStepSegments(text)).toEqual([{ type: "text", value: text }])
  })

  it("parses text with a single duration", () => {
    const text = "Bake in the oven for 25 minutes until golden."
    expect(parseStepSegments(text)).toEqual([
      { type: "text", value: "Bake in the oven for " },
      { type: "timer", value: "25 minutes", seconds: 1500 },
      { type: "text", value: " until golden." },
    ])
  })

  it("parses multiple durations within a single step", () => {
    const text = "Sear for 2 mins per side, then bake for 15 mins."
    expect(parseStepSegments(text)).toEqual([
      { type: "text", value: "Sear for " },
      { type: "timer", value: "2 mins", seconds: 120 },
      { type: "text", value: " per side, then bake for " },
      { type: "timer", value: "15 mins", seconds: 900 },
      { type: "text", value: "." },
    ])
  })

  it("ignores ingredient measurements without false positives", () => {
    const text = "Add 250g flour, 2 tbsp sugar, and 500ml milk. Simmer for 10 minutes."
    expect(parseStepSegments(text)).toEqual([
      {
        type: "text",
        value: "Add 250g flour, 2 tbsp sugar, and 500ml milk. Simmer for ",
      },
      { type: "timer", value: "10 minutes", seconds: 600 },
      { type: "text", value: "." },
    ])
  })

  it("handles duration at the very start of string", () => {
    const text = "15 mins on high heat, stirring constantly."
    expect(parseStepSegments(text)).toEqual([
      { type: "timer", value: "15 mins", seconds: 900 },
      { type: "text", value: " on high heat, stirring constantly." },
    ])
  })

  it("handles duration at the very end of string", () => {
    const text = "Let rest for 10 mins"
    expect(parseStepSegments(text)).toEqual([
      { type: "text", value: "Let rest for " },
      { type: "timer", value: "10 mins", seconds: 600 },
    ])
  })
})

describe("formatTimerDisplay", () => {
  it("formats seconds less than a minute", () => {
    expect(formatTimerDisplay(0)).toBe("00:00")
    expect(formatTimerDisplay(9)).toBe("00:09")
    expect(formatTimerDisplay(45)).toBe("00:45")
  })

  it("formats minutes and seconds", () => {
    expect(formatTimerDisplay(60)).toBe("01:00")
    expect(formatTimerDisplay(65)).toBe("01:05")
    expect(formatTimerDisplay(888)).toBe("14:48")
  })

  it("formats hours, minutes, and seconds", () => {
    expect(formatTimerDisplay(3600)).toBe("1:00:00")
    expect(formatTimerDisplay(3665)).toBe("1:01:05")
    expect(formatTimerDisplay(7325)).toBe("2:02:05")
  })

  it("handles negative values gracefully by clamping to zero", () => {
    expect(formatTimerDisplay(-10)).toBe("00:00")
  })
})

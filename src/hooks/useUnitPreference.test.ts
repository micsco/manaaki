import { act, renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { useUnitPreference } from "./useUnitPreference"

const STORAGE_KEY = "manaaki:cooking:v1:unit-system"

describe("useUnitPreference", () => {
  it("defaults to metric", () => {
    const { result } = renderHook(() => useUnitPreference())
    expect(result.current[0]).toBe("metric")
  })

  it("remembers the chosen system", () => {
    const { result } = renderHook(() => useUnitPreference())
    act(() => result.current[1]("us"))
    expect(result.current[0]).toBe("us")
    expect(localStorage.getItem(STORAGE_KEY)).toBe('"us"')
  })

  it("shares the choice between components", () => {
    const first = renderHook(() => useUnitPreference())
    const second = renderHook(() => useUnitPreference())
    act(() => first.result.current[1]("as-written"))
    expect(second.result.current[0]).toBe("as-written")
  })

  it("falls back to metric when storage holds something unknown", () => {
    localStorage.setItem(STORAGE_KEY, '"imperial"')
    const { result } = renderHook(() => useUnitPreference())
    expect(result.current[0]).toBe("metric")
  })
})

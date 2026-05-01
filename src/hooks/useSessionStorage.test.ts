import { act, renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { useSessionStorage } from "./useSessionStorage"

describe("useSessionStorage", () => {
  it("returns initialValue when storage is empty", () => {
    const { result } = renderHook(() => useSessionStorage("test-key", false))
    expect(result.current[0]).toBe(false)
  })

  it("returns initialValue of a different type", () => {
    const { result } = renderHook(() => useSessionStorage("test-key", "hello"))
    expect(result.current[0]).toBe("hello")
  })

  it("reads a pre-existing value from sessionStorage on mount", () => {
    sessionStorage.setItem("test-key", "true")
    const { result } = renderHook(() => useSessionStorage("test-key", false))
    expect(result.current[0]).toBe(true)
  })

  it("reads a pre-existing string value from sessionStorage on mount", () => {
    sessionStorage.setItem("test-key", JSON.stringify("stored"))
    const { result } = renderHook(() => useSessionStorage("test-key", "default"))
    expect(result.current[0]).toBe("stored")
  })

  it("persists a new value to sessionStorage on setValue", () => {
    const { result } = renderHook(() => useSessionStorage("test-key", false))

    act(() => {
      result.current[1](true)
    })

    expect(result.current[0]).toBe(true)
    expect(sessionStorage.getItem("test-key")).toBe("true")
  })

  it("supports functional updater form", () => {
    const { result } = renderHook(() => useSessionStorage("test-key", false))

    act(() => {
      result.current[1](prev => !prev)
    })

    expect(result.current[0]).toBe(true)
    expect(sessionStorage.getItem("test-key")).toBe("true")
  })

  it("toggles value correctly with functional updater called twice", () => {
    const { result } = renderHook(() => useSessionStorage("test-key", false))

    act(() => {
      result.current[1](prev => !prev)
    })
    act(() => {
      result.current[1](prev => !prev)
    })

    expect(result.current[0]).toBe(false)
    expect(sessionStorage.getItem("test-key")).toBe("false")
  })

  it("falls back to initialValue when stored JSON is invalid", () => {
    sessionStorage.setItem("test-key", "not-valid-json{{{")
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined)

    const { result } = renderHook(() => useSessionStorage("test-key", 42))

    expect(result.current[0]).toBe(42)
    consoleSpy.mockRestore()
  })

  it("isolates values by key", () => {
    const { result: result1 } = renderHook(() => useSessionStorage("key-a", 0))
    const { result: result2 } = renderHook(() => useSessionStorage("key-b", 0))

    act(() => {
      result1.current[1](1)
    })

    expect(result1.current[0]).toBe(1)
    expect(result2.current[0]).toBe(0)
  })
})

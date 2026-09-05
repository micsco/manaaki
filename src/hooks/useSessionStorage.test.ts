import { act, renderHook } from "@testing-library/react"
import { createElement } from "react"
import { renderToString } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

import { useSessionStorage, useSessionStorageGroup } from "./useSessionStorage"

describe("useSessionStorage", () => {
  it("uses the default value during server rendering even when storage contains a value", () => {
    sessionStorage.setItem("hydration", "true")
    function StoredValue() {
      const [value] = useSessionStorage("hydration", false)
      return createElement("span", null, String(value))
    }
    expect(renderToString(createElement(StoredValue))).toBe("<span>false</span>")
  })
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

  it("applies consecutive updates to the latest storage value and synchronizes subscribers", () => {
    const first = renderHook(() => useSessionStorage("shared", 0))
    const second = renderHook(() => useSessionStorage("shared", 0))
    act(() => {
      first.result.current[1](previous => previous + 1)
      second.result.current[1](previous => previous + 1)
    })
    expect(first.result.current[0]).toBe(2)
    expect(second.result.current[0]).toBe(2)
  })

  it("updates immediately when the storage key changes", () => {
    sessionStorage.setItem("second", "42")
    const { result, rerender } = renderHook(({ key }) => useSessionStorage(key, 0), {
      initialProps: { key: "first" },
    })
    rerender({ key: "second" })
    expect(result.current[0]).toBe(42)
  })

  it("keeps object snapshots stable across renders", () => {
    sessionStorage.setItem("object", '{"count":1}')
    const initial = { count: 0 }
    const { result, rerender } = renderHook(() => useSessionStorage("object", initial))
    const snapshot = result.current[0]
    rerender()
    expect(result.current[0]).toBe(snapshot)
  })

  it("responds to native storage events", () => {
    const { result } = renderHook(() => useSessionStorage("native", false))
    act(() => {
      sessionStorage.setItem("native", "true")
      window.dispatchEvent(new StorageEvent("storage", { key: "native" }))
    })
    expect(result.current[0]).toBe(true)
  })
})

describe("useSessionStorageGroup", () => {
  it("updates both individual subscribers and the whole group", () => {
    const item = renderHook(() => useSessionStorage("one", false))
    const group = renderHook(() => useSessionStorageGroup(["one", "two"]))
    act(() => group.result.current.toggleAll())
    expect(item.result.current[0]).toBe(true)
    expect(group.result.current.allChecked).toBe(true)
    act(() => item.result.current[1](false))
    expect(group.result.current.allChecked).toBe(false)
  })

  it("treats an empty group as unchecked", () => {
    const { result } = renderHook(() => useSessionStorageGroup([]))
    act(() => result.current.toggleAll())
    expect(result.current.allChecked).toBe(false)
  })

  it("uses the new group when the keys change", () => {
    sessionStorage.setItem("checked", "true")
    const { result, rerender } = renderHook(({ keys }) => useSessionStorageGroup(keys), {
      initialProps: { keys: ["checked"] },
    })
    expect(result.current.allChecked).toBe(true)
    rerender({ keys: ["unchecked"] })
    expect(result.current.allChecked).toBe(false)
  })
})

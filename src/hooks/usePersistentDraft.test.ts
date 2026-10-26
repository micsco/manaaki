import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { clearCookingStorage } from "../pwa/client"
import { DRAFT_TTL_MS, pruneExpiredDrafts, usePersistentDraft } from "./usePersistentDraft"

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe("usePersistentDraft", () => {
  it("starts from the initial value", () => {
    const { result } = renderHook(() => usePersistentDraft("note", "start"))
    expect(result.current[0]).toBe("start")
  })

  it("keeps a typed value across a reload", () => {
    const first = renderHook(() => usePersistentDraft("note", ""))
    act(() => first.result.current[1]("Two batches"))
    expect(first.result.current[0]).toBe("Two batches")
    first.unmount()
    const second = renderHook(() => usePersistentDraft("note", ""))
    expect(second.result.current[0]).toBe("Two batches")
  })

  it("updates from the previous value", () => {
    const { result } = renderHook(() => usePersistentDraft("count", 1))
    act(() => result.current[1](previous => previous + 1))
    act(() => result.current[1](previous => previous + 1))
    expect(result.current[0]).toBe(3)
  })

  it("forgets the draft when cleared", () => {
    const { result } = renderHook(() => usePersistentDraft("note", ""))
    act(() => result.current[1]("Draft"))
    act(() => result.current[2]())
    expect(result.current[0]).toBe("")
    expect(localStorage.length).toBe(0)
  })

  it("ignores a draft made against an older version of the item", () => {
    const first = renderHook(() => usePersistentDraft("entry", "", { base: "v1" }))
    act(() => first.result.current[1]("Old edit"))
    first.unmount()
    const second = renderHook(() => usePersistentDraft("entry", "", { base: "v2" }))
    expect(second.result.current[0]).toBe("")
  })

  it("ignores and prunes drafts older than a day", () => {
    vi.useFakeTimers({ now: 0 })
    const first = renderHook(() => usePersistentDraft("note", ""))
    act(() => first.result.current[1]("Yesterday"))
    first.unmount()
    vi.setSystemTime(DRAFT_TTL_MS + 1)
    const second = renderHook(() => usePersistentDraft("note", ""))
    expect(second.result.current[0]).toBe("")
    pruneExpiredDrafts()
    expect(localStorage.length).toBe(0)
  })

  it("keeps working in memory when the browser refuses to store it", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Quota exceeded", "QuotaExceededError")
    })
    const { result } = renderHook(() => usePersistentDraft("note", ""))
    act(() => result.current[1]("Still typing"))
    expect(result.current[0]).toBe("Still typing")
    act(() => clearCookingStorage())
    expect(result.current[0]).toBe("")
  })

  it("is cleared when the user signs out", () => {
    const { result } = renderHook(() => usePersistentDraft("note", ""))
    act(() => result.current[1]("Private"))
    act(() => clearCookingStorage())
    expect(result.current[0]).toBe("")
  })
})

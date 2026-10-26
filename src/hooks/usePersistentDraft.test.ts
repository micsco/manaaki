import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { appAnalytics } from "../lib/analytics"
import { clearCookingStorage } from "../pwa/client"
import {
  DRAFT_TTL_MS,
  pruneExpiredDrafts,
  reportRestoredDraft,
  usePersistentDraft,
} from "./usePersistentDraft"

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

describe("draft metrics", () => {
  function storeDraft(key: string, savedAt: number, value: unknown = "saved") {
    localStorage.setItem(`manaaki:draft:v1:${key}`, JSON.stringify({ savedAt, base: null, value }))
  }

  it("counts a draft saved before this page loaded as restored, by kind", () => {
    const count = vi.spyOn(appAnalytics, "count")
    storeDraft("meal-plan:recipe:abc", performance.timeOrigin - 60_000)
    const { result } = renderHook(() => usePersistentDraft("meal-plan:recipe:abc", ""))
    expect(result.current[0]).toBe("saved")
    expect(count).toHaveBeenCalledWith("draft.restored", 1, { attributes: { kind: "meal-plan" } })
    localStorage.clear()
  })

  it("does not count a draft written earlier in the same page load", () => {
    const count = vi.spyOn(appAnalytics, "count")
    storeDraft("recipe-version:abc", Date.now())
    reportRestoredDraft("recipe-version:abc")
    expect(count).not.toHaveBeenCalled()
    localStorage.clear()
  })

  it("counts expired drafts as they are pruned", () => {
    const count = vi.spyOn(appAnalytics, "count")
    storeDraft("import-recipe:url", Date.now() - DRAFT_TTL_MS - 1)
    storeDraft("shopping-list:1:new-item", Date.now())
    pruneExpiredDrafts()
    expect(count).toHaveBeenCalledTimes(1)
    expect(count).toHaveBeenCalledWith("draft.expired", 1, {
      attributes: { kind: "import-recipe" },
    })
    localStorage.clear()
  })
})

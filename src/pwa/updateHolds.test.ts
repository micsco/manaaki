import { renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  holdAppUpdate,
  noteTyping,
  resetUpdateHoldsForTesting,
  trackPendingWrite,
  TYPING_GRACE_MS,
  updateBlockers,
  useHoldAppUpdate,
} from "./updateHolds"

afterEach(() => {
  resetUpdateHoldsForTesting()
  document.body.innerHTML = ""
  vi.useRealTimers()
})

describe("updateBlockers", () => {
  it("is clear when nothing is in progress", () => {
    expect(updateBlockers("in-place")).toEqual([])
    expect(updateBlockers("navigation")).toEqual([])
  })

  it("respects holds until they are released", () => {
    const release = holdAppUpdate("saving-plan")
    expect(updateBlockers("navigation")).toEqual(["saving-plan"])
    release()
    expect(updateBlockers("navigation")).toEqual([])
  })

  it("applies scoped holds only to their own kind of update", () => {
    holdAppUpdate("cooking", "in-place")
    holdAppUpdate("draft", "navigation")
    expect(updateBlockers("in-place")).toEqual(["cooking"])
    expect(updateBlockers("navigation")).toEqual(["draft"])
  })

  it("holds while the hook's condition is true", () => {
    const { rerender, unmount } = renderHook(({ active }) => useHoldAppUpdate(active, "timer"), {
      initialProps: { active: true },
    })
    expect(updateBlockers("in-place")).toEqual(["timer"])
    rerender({ active: false })
    expect(updateBlockers("in-place")).toEqual([])
    rerender({ active: true })
    unmount()
    expect(updateBlockers("in-place")).toEqual([])
  })

  it("holds for the whole of a write, including when it fails", async () => {
    let finish!: () => void
    const write = trackPendingWrite(() => new Promise<void>(resolve => (finish = resolve)))
    expect(updateBlockers("navigation")).toEqual(["saving"])
    finish()
    await write
    expect(updateBlockers("navigation")).toEqual([])
    await expect(trackPendingWrite(() => Promise.reject(new Error("offline")))).rejects.toThrow()
    expect(updateBlockers("navigation")).toEqual([])
  })

  it("holds while someone is typing into a field, then lets go after a pause", () => {
    vi.useFakeTimers()
    document.body.innerHTML = '<input aria-label="Item" />'
    const input = document.querySelector("input")!
    input.focus()
    input.value = "Milk"
    noteTyping({ target: input } as unknown as Event)
    expect(updateBlockers("navigation")).toEqual(["typing"])
    vi.advanceTimersByTime(TYPING_GRACE_MS)
    expect(updateBlockers("navigation")).toEqual([])
  })

  it("ignores an empty focused field", () => {
    document.body.innerHTML = '<input aria-label="Search" />'
    const input = document.querySelector("input")!
    input.focus()
    noteTyping({ target: input } as unknown as Event)
    expect(updateBlockers("in-place")).toEqual([])
  })

  it("holds in-place updates while a dialog is open unless it is marked safe", () => {
    document.body.innerHTML = '<div role="dialog"></div>'
    expect(updateBlockers("in-place")).toEqual(["dialog"])
    expect(updateBlockers("navigation")).toEqual([])
    document.body.innerHTML = '<div role="dialog" data-update-safe></div>'
    expect(updateBlockers("in-place")).toEqual([])
  })
})

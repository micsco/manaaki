import { act, renderHook } from "@testing-library/react"
import { expect, it, vi } from "vitest"

import { receiveShoppingStatus, useShoppingSync } from "./shoppingSync"

it("notifies subscribers when a pending queue finishes syncing", () => {
  receiveShoppingStatus(0)
  const synced = vi.fn()
  window.addEventListener("shopping-synced", synced)
  const { result } = renderHook(() => useShoppingSync())
  act(() => {
    receiveShoppingStatus(1)
  })
  expect(result.current.pending).toBe(1)
  act(() => {
    receiveShoppingStatus(0)
  })
  expect(synced).toHaveBeenCalledOnce()
  window.removeEventListener("shopping-synced", synced)
})

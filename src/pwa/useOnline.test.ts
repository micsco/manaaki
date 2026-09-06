import { act, renderHook } from "@testing-library/react"
import { expect, it } from "vitest"

import { setServerReachable, useOnline } from "./useOnline"

it("reports an unreachable server even when the browser reports an active network", () => {
  const { result } = renderHook(() => useOnline())
  act(() => {
    setServerReachable(false)
  })
  expect(result.current).toBe(false)
  act(() => {
    setServerReachable(true)
  })
  expect(result.current).toBe(true)
})

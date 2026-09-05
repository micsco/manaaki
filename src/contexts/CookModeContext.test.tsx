import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { CookModeProvider, useCookMode } from "./CookModeContext"

vi.mock("nuqs", async importOriginal => ({
  ...(await importOriginal<typeof import("nuqs")>()),
  useQueryState: () => [true, vi.fn()],
}))

afterEach(() => vi.restoreAllMocks())

describe("CookModeProvider wake lock", () => {
  it("releases a lock that arrives after unmount", async () => {
    let resolveLock!: (lock: WakeLockSentinel) => void
    const pending = new Promise<WakeLockSentinel>(resolve => {
      resolveLock = resolve
    })
    vi.spyOn(navigator.wakeLock, "request").mockReturnValue(pending)
    const release = vi.fn().mockResolvedValue(undefined)
    const { unmount } = renderHook(() => useCookMode(), { wrapper: CookModeProvider })
    unmount()
    await act(async () => {
      resolveLock({ release } as unknown as WakeLockSentinel)
      await pending
    })
    expect(release).toHaveBeenCalledOnce()
  })

  it("handles a rejected release during cleanup", async () => {
    const release = vi.fn().mockRejectedValue(new Error("Already released"))
    vi.spyOn(navigator.wakeLock, "request").mockResolvedValue({
      release,
    } as unknown as WakeLockSentinel)
    const { unmount } = renderHook(() => useCookMode(), { wrapper: CookModeProvider })
    await act(async () => {})
    unmount()
    await act(async () => {})
    expect(release).toHaveBeenCalledOnce()
  })
})

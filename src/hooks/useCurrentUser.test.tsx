import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import * as auth from "../api/auth"
import { useCurrentUser } from "./useCurrentUser"

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe("useCurrentUser", () => {
  it("returns the current-user payload", async () => {
    vi.spyOn(auth, "fetchCurrentUser").mockResolvedValue({
      user: { groupSlug: "home" } as never,
      isAnonymous: true,
    })
    const { result } = renderHook(() => useCurrentUser(), { wrapper })
    await waitFor(() => expect(result.current?.isAnonymous).toBe(true))
    expect(result.current?.user?.groupSlug).toBe("home")
    vi.restoreAllMocks()
  })
})

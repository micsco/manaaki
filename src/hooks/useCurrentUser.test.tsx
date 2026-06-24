import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { useCurrentUser } from "./useCurrentUser"

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe("useCurrentUser", () => {
  it("returns the me payload", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ user: { groupSlug: "home" }, isAnonymous: true }), {
        status: 200,
      })
    )
    const { result } = renderHook(() => useCurrentUser(), { wrapper })
    await waitFor(() => expect(result.current?.isAnonymous).toBe(true))
    expect(result.current?.user?.groupSlug).toBe("home")
    vi.restoreAllMocks()
  })
})

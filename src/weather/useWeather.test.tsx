import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, expect, it, vi } from "vitest"

import { loadWeather, weatherMaxAge } from "./forecast"
import { useWeather } from "./useWeather"

vi.mock("./forecast", async importOriginal => ({
  ...(await importOriginal<typeof import("./forecast")>()),
  loadWeather: vi.fn(),
}))
beforeEach(() => vi.clearAllMocks())
it("shares a request between consumers", async () => {
  vi.mocked(loadWeather).mockResolvedValue({ version: 1, fetchedAt: Date.now(), days: [] })
  const client = new QueryClient()
  const { result } = renderHook(() => [useWeather(), useWeather()], {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  })
  await waitFor(() => expect(result.current[0].snapshot).toBeDefined())
  expect(result.current[1].snapshot).toEqual(result.current[0].snapshot)
  expect(loadWeather).toHaveBeenCalledOnce()
})
it("hides an expired in-memory snapshot", async () => {
  vi.mocked(loadWeather).mockResolvedValue({
    version: 1,
    fetchedAt: Date.now() - weatherMaxAge - 60000,
    days: [],
  })
  const client = new QueryClient()
  const { result } = renderHook(() => useWeather(), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  })
  await waitFor(() => expect(result.current.isPending).toBe(false))
  expect(result.current.snapshot).toBeUndefined()
})

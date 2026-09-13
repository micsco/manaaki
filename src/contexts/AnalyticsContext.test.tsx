import { act, fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

import { loadAnalytics } from "../lib/loadAnalytics"
import { AnalyticsPageViews, AnalyticsProvider, usePostHog } from "./AnalyticsContext"

let fetching = 0
let resolved: () => void
const unsubscribe = vi.fn()
const router = {
  subscribe: vi.fn((_event: string, callback: () => void) => {
    resolved = callback
    return unsubscribe
  }),
}
vi.mock("@tanstack/react-query", () => ({ useIsFetching: () => fetching }))
vi.mock("@tanstack/react-router", () => ({ useRouter: () => router }))
vi.mock("../lib/loadAnalytics", () => ({ loadAnalytics: vi.fn() }))

function Counter() {
  const [count, setCount] = useState(0)
  const analytics = usePostHog()
  return (
    <button
      onClick={() => {
        setCount(count + 1)
        analytics.capture("tap")
      }}
    >
      Count {count}
    </button>
  )
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubEnv("VITE_PUBLIC_POSTHOG_PROJECT_TOKEN", "fixture")
  vi.mocked(loadAnalytics).mockResolvedValue({ capture: vi.fn() } as never)
  fetching = 0
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

it("waits for queries to settle, preserves early taps, and never remounts the app", async () => {
  const capture = vi.fn()
  vi.mocked(loadAnalytics).mockResolvedValue({ capture } as never)
  fetching = 1
  const view = render(
    <AnalyticsProvider>
      <Counter />
    </AnalyticsProvider>
  )
  fireEvent.click(screen.getByRole("button", { name: "Count 0" }))
  await act(() => vi.advanceTimersByTimeAsync(3000))
  expect(loadAnalytics).not.toHaveBeenCalled()
  fetching = 0
  view.rerender(
    <AnalyticsProvider>
      <Counter />
    </AnalyticsProvider>
  )
  await act(() => vi.advanceTimersByTimeAsync(999))
  expect(loadAnalytics).not.toHaveBeenCalled()
  await act(() => vi.advanceTimersByTimeAsync(1))
  expect(loadAnalytics).toHaveBeenCalledTimes(1)
  expect(capture).toHaveBeenCalledWith("tap", expect.anything(), expect.anything())
  expect(screen.getByRole("button", { name: "Count 1" })).toBeVisible()
  fireEvent.click(screen.getByRole("button", { name: "Count 1" }))
  expect(capture).toHaveBeenCalledTimes(2)
})

it("cancels scheduled work on unmount and skips loading without a project key", async () => {
  const view = render(
    <AnalyticsProvider>
      <Counter />
    </AnalyticsProvider>
  )
  view.unmount()
  await act(() => vi.advanceTimersByTimeAsync(2000))
  expect(loadAnalytics).not.toHaveBeenCalled()
  vi.stubEnv("VITE_PUBLIC_POSTHOG_PROJECT_TOKEN", "")
  render(
    <AnalyticsProvider>
      <Counter />
    </AnalyticsProvider>
  )
  await act(() => vi.advanceTimersByTimeAsync(2000))
  expect(loadAnalytics).not.toHaveBeenCalled()
})

it("keeps the app usable when analytics cannot download", async () => {
  vi.mocked(loadAnalytics).mockRejectedValue(new Error("offline"))
  render(
    <AnalyticsProvider>
      <Counter />
    </AnalyticsProvider>
  )
  await act(() => vi.advanceTimersByTimeAsync(2000))
  fireEvent.click(screen.getByRole("button", { name: "Count 0" }))
  expect(screen.getByRole("button", { name: "Count 1" })).toBeVisible()
})

it("queues the first pageview and subsequent navigation without duplicating resolutions", async () => {
  const capture = vi.fn()
  vi.mocked(loadAnalytics).mockResolvedValue({ capture } as never)
  window.history.replaceState(null, "", "/plan")
  const view = render(
    <AnalyticsProvider>
      <AnalyticsPageViews />
    </AnalyticsProvider>
  )
  resolved()
  window.history.replaceState(null, "", "/recipes")
  resolved()
  await act(() => vi.advanceTimersByTimeAsync(1000))
  expect(capture).toHaveBeenCalledTimes(2)
  expect(capture).toHaveBeenNthCalledWith(
    1,
    "$pageview",
    expect.objectContaining({ $pathname: "/plan" }),
    expect.anything()
  )
  expect(capture).toHaveBeenNthCalledWith(
    2,
    "$pageview",
    expect.objectContaining({ $pathname: "/recipes" }),
    expect.anything()
  )
  view.unmount()
  expect(unsubscribe).toHaveBeenCalled()
})

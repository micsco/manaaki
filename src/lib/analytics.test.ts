import { expect, it, vi } from "vitest"

import { createBufferedAnalytics } from "./analytics"

it("replays early events once, retaining their original page and timestamp", () => {
  const analytics = createBufferedAnalytics(true)
  const capture = vi.fn()
  window.history.replaceState(null, "", "/recipes/first")
  const before = new Date()
  analytics.capture("recipe_viewed", { recipe_id: "first" })
  window.history.replaceState(null, "", "/plan")
  analytics.connect({ capture })
  analytics.connect({ capture })
  expect(capture).toHaveBeenCalledTimes(1)
  expect(capture).toHaveBeenCalledWith(
    "recipe_viewed",
    expect.objectContaining({
      recipe_id: "first",
      $pathname: "/recipes/first",
    }),
    { timestamp: expect.any(Date) }
  )
  expect(capture.mock.calls[0][2].timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime())
  analytics.capture("cook_mode_entered")
  expect(capture).toHaveBeenLastCalledWith(
    "cook_mode_entered",
    expect.objectContaining({ $pathname: "/plan" }),
    { timestamp: expect.any(Date) }
  )
})

it("does not collect events when analytics is disabled", () => {
  const analytics = createBufferedAnalytics(false)
  const capture = vi.fn()
  analytics.capture("early")
  analytics.connect({ capture })
  analytics.capture("late")
  expect(capture).not.toHaveBeenCalled()
})

it("bounds memory when analytics never loads", () => {
  const analytics = createBufferedAnalytics(true)
  const capture = vi.fn()
  for (let index = 0; index < 250; index++) analytics.capture("tap", { index })
  analytics.connect({ capture })
  expect(capture).toHaveBeenCalledTimes(200)
  expect(capture.mock.calls[0][1].index).toBe(50)
})

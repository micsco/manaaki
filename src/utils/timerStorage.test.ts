// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest"

import { persistTimers, restoreTimers } from "./timerStorage"

describe("timer storage", () => {
  it("ignores corrupt storage and invalid timers", () => {
    localStorage.setItem("manaaki:cooking:v1:timers", "invalid")
    expect(restoreTimers()).toEqual([])
    localStorage.setItem("manaaki:cooking:v1:timers", '[null,{}, {"id":"bad"}]')
    expect(restoreTimers()).toEqual([])
  })

  it("continues when storage is unavailable", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Quota")
    })
    expect(() => persistTimers([])).not.toThrow()
    spy.mockRestore()
  })
})

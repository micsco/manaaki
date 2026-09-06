import { afterEach, expect, it, vi } from "vitest"

import { applyAppUpdate, clearCookingStorage, registerOfflineSupport } from "./client"

afterEach(() => vi.unstubAllGlobals())

it("clears app-owned private progress without affecting unrelated storage", () => {
  localStorage.setItem("manaaki:cooking:v1:step", "true")
  localStorage.setItem("unrelated", "keep")
  clearCookingStorage()
  expect(localStorage.getItem("manaaki:cooking:v1:step")).toBeNull()
  expect(localStorage.getItem("unrelated")).toBe("keep")
})

it("activates a waiting worker only after the user applies the update", async () => {
  const postMessage = vi.fn()
  const addEventListener = vi.fn()
  vi.stubGlobal("navigator", {
    serviceWorker: {
      getRegistration: async () => ({ waiting: { postMessage } }),
      addEventListener,
    },
  })
  await applyAppUpdate()
  expect(postMessage).toHaveBeenCalledWith({ type: "ACTIVATE_UPDATE" })
  expect(addEventListener).toHaveBeenCalledWith("controllerchange", expect.any(Function), {
    once: true,
  })
})

it("gracefully skips browsers without service workers", async () => {
  vi.stubGlobal("navigator", {})
  const firstControl = vi.fn()
  const cleanup = await registerOfflineSupport(firstControl)
  cleanup()
  expect(firstControl).not.toHaveBeenCalled()
})

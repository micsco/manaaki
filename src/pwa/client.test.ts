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

it("tells the app to reload when the worker finds a newer recipe", async () => {
  const listeners = new Map<string, (event: MessageEvent) => void>()
  const registration = { addEventListener: vi.fn(), removeEventListener: vi.fn(), update: vi.fn() }
  vi.stubGlobal("navigator", {
    onLine: true,
    serviceWorker: {
      controller: null,
      addEventListener: (type: string, listener: (event: MessageEvent) => void) =>
        listeners.set(type, listener),
      removeEventListener: vi.fn(),
      register: async () => registration,
    },
  })
  const updated = vi.fn()
  window.addEventListener("recipe-updated", updated)
  const cleanup = await registerOfflineSupport(vi.fn())
  listeners.get("message")?.(new MessageEvent("message", { data: { type: "RECIPE_UPDATED" } }))
  expect(updated).toHaveBeenCalledTimes(1)
  cleanup()
  window.removeEventListener("recipe-updated", updated)
})

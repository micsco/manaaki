import { afterEach, expect, it, vi } from "vitest"

import { resetAppUpdateForTesting, updatePendingSince } from "./appUpdate"
import { clearCookingStorage, registerOfflineSupport } from "./client"

afterEach(() => {
  vi.unstubAllGlobals()
  resetAppUpdateForTesting()
})

it("clears app-owned private progress without affecting unrelated storage", () => {
  localStorage.setItem("manaaki:cooking:v1:step", "true")
  localStorage.setItem("manaaki:draft:v1:note", "{}")
  localStorage.setItem("unrelated", "keep")
  clearCookingStorage()
  expect(localStorage.getItem("manaaki:cooking:v1:step")).toBeNull()
  expect(localStorage.getItem("manaaki:draft:v1:note")).toBeNull()
  expect(localStorage.getItem("unrelated")).toBe("keep")
})

it("marks an update as pending when a new worker is waiting", async () => {
  const registration = {
    active: {},
    waiting: {},
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    update: vi.fn(),
  }
  vi.stubGlobal("navigator", {
    onLine: true,
    serviceWorker: {
      controller: { postMessage: vi.fn() },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      register: async () => registration,
    },
  })
  const cleanup = await registerOfflineSupport(vi.fn())
  expect(updatePendingSince()).not.toBeNull()
  cleanup()
})

it("marks an update as pending when another tab switched this one to a new worker", async () => {
  const listeners = new Map<string, () => void>()
  const registration = { addEventListener: vi.fn(), removeEventListener: vi.fn(), update: vi.fn() }
  vi.stubGlobal("navigator", {
    onLine: true,
    serviceWorker: {
      controller: { postMessage: vi.fn() },
      addEventListener: (type: string, listener: () => void) => listeners.set(type, listener),
      removeEventListener: vi.fn(),
      register: async () => registration,
    },
  })
  const firstControl = vi.fn()
  const cleanup = await registerOfflineSupport(firstControl)
  expect(updatePendingSince()).toBeNull()
  listeners.get("controllerchange")?.()
  expect(updatePendingSince()).not.toBeNull()
  expect(firstControl).not.toHaveBeenCalled()
  cleanup()
})

it("does not treat the first install as an update", async () => {
  const listeners = new Map<string, () => void>()
  const registration = { addEventListener: vi.fn(), removeEventListener: vi.fn(), update: vi.fn() }
  vi.stubGlobal("navigator", {
    onLine: true,
    serviceWorker: {
      controller: null,
      addEventListener: (type: string, listener: () => void) => listeners.set(type, listener),
      removeEventListener: vi.fn(),
      register: async () => registration,
    },
  })
  const firstControl = vi.fn()
  const cleanup = await registerOfflineSupport(firstControl)
  listeners.get("controllerchange")?.()
  expect(firstControl).toHaveBeenCalledTimes(1)
  expect(updatePendingSince()).toBeNull()
  cleanup()
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

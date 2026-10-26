import "@testing-library/jest-dom/vitest"
import { vi } from "vitest"

Object.defineProperty(navigator, "wakeLock", {
  value: {
    request: vi.fn().mockResolvedValue({ release: vi.fn().mockResolvedValue(undefined) }),
  },
  writable: true,
})

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  sessionStorage.clear()
  localStorage.clear()
})

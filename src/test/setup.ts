import "@testing-library/jest-dom/vitest"
import { vi } from "vitest"

Object.defineProperty(navigator, "wakeLock", {
  value: {
    request: vi.fn().mockResolvedValue({ release: vi.fn() }),
  },
  writable: true,
})

beforeEach(() => {
  sessionStorage.clear()
})

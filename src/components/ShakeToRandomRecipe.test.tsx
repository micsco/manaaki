import { act, fireEvent, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { MotionPermissionState } from "../hooks/useMotionPermission"
import { render } from "../test/render"
import { ShakeToRandomRecipe } from "./ShakeToRandomRecipe"

const mockNavigate = vi.fn()
const mockCapture = vi.fn()
const mockRequestPermission = vi.fn()
let shakeCallback: (() => void) | null = null
let permissionState: MotionPermissionState = "granted"

const RECIPE_A = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  slug: "pasta-bake",
  name: "Pasta Bake",
}
const RECIPE_B = {
  id: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  slug: "chicken-soup",
  name: "Chicken Soup",
}

vi.mock("../hooks/useRecipeList", () => ({
  useRecipeList: vi.fn(() => [RECIPE_A, RECIPE_B]),
}))

vi.mock("../hooks/useShakeDetection", () => ({
  useShakeDetection: vi.fn(({ onShake }: { onShake: () => void }) => {
    shakeCallback = onShake
  }),
}))

vi.mock("../contexts/MotionPermissionContext", () => ({
  useMotionPermissionContext: vi.fn(() => ({
    state: permissionState,
    request: mockRequestPermission,
  })),
}))

vi.mock("@tanstack/react-router", async importOriginal => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>()
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock("@posthog/react", () => ({
  usePostHog: () => ({ capture: mockCapture }),
}))

describe("ShakeToRandomRecipe", () => {
  beforeEach(() => {
    shakeCallback = null
    permissionState = "granted"
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe("when permission is unavailable (desktop)", () => {
    it("renders nothing", () => {
      permissionState = "unavailable"
      render(<ShakeToRandomRecipe />)
      expect(screen.queryByRole("button")).not.toBeInTheDocument()
    })
  })

  describe("when permission is prompt (iOS, not yet asked)", () => {
    it("renders nothing — permission is requested via the About modal instead", () => {
      permissionState = "prompt"
      render(<ShakeToRandomRecipe />)
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
      expect(screen.queryByRole("button")).not.toBeInTheDocument()
    })
  })

  describe("when permission is granted (Android or post-iOS-approval)", () => {
    it("renders nothing when idle", () => {
      render(<ShakeToRandomRecipe />)
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
      expect(screen.queryByRole("button")).not.toBeInTheDocument()
    })

    it("shows the overlay when a shake is detected", () => {
      render(<ShakeToRandomRecipe />)
      act(() => shakeCallback?.())
      expect(screen.getByRole("dialog")).toBeInTheDocument()
      expect(screen.getByText("Random Recipe")).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /tap to cancel/i })).toBeInTheDocument()
    })

    it("dismisses the overlay when 'Tap to cancel' is clicked", async () => {
      const user = userEvent.setup()
      render(<ShakeToRandomRecipe />)
      act(() => shakeCallback?.())
      await user.click(screen.getByRole("button", { name: /tap to cancel/i }))
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })

    it("tracks a PostHog event when shake is triggered", () => {
      render(<ShakeToRandomRecipe />)
      act(() => shakeCallback?.())
      expect(mockCapture).toHaveBeenCalledWith(
        "shake_random_recipe_triggered",
        expect.objectContaining({ total_recipes: 2 })
      )
    })

    it("tracks a PostHog event when cancelled", async () => {
      const user = userEvent.setup()
      render(<ShakeToRandomRecipe />)
      act(() => shakeCallback?.())
      await user.click(screen.getByRole("button", { name: /tap to cancel/i }))
      expect(mockCapture).toHaveBeenCalledWith(
        "shake_random_recipe_cancelled",
        expect.objectContaining({ recipe_id: expect.any(String) })
      )
    })

    it("navigates to the random recipe after the countdown elapses", () => {
      vi.useFakeTimers()
      render(<ShakeToRandomRecipe />)
      act(() => shakeCallback?.())
      expect(screen.getByRole("dialog")).toBeInTheDocument()
      act(() => vi.advanceTimersByTime(5000))
      expect(mockNavigate).toHaveBeenCalledTimes(1)
      expect(mockCapture).toHaveBeenCalledWith(
        "shake_random_recipe_navigated",
        expect.objectContaining({ recipe_id: expect.any(String) })
      )
    })

    it("does not navigate if cancelled before countdown elapses", () => {
      vi.useFakeTimers()
      render(<ShakeToRandomRecipe />)
      act(() => shakeCallback?.())
      fireEvent.click(screen.getByRole("button", { name: /tap to cancel/i }))
      act(() => vi.advanceTimersByTime(5000))
      expect(mockNavigate).not.toHaveBeenCalled()
    })

    it("shows the recipe name in the overlay", () => {
      render(<ShakeToRandomRecipe />)
      act(() => shakeCallback?.())
      expect(screen.getByText(/Pasta Bake|Chicken Soup/)).toBeInTheDocument()
    })
  })
})

import { afterEach, describe, expect, it, vi } from "vitest"
import type { RecipeOutput } from "../api/generated/types.gen"
import { render, screen, waitFor } from "../test/render"
import { ShareRecipeButton } from "./ShareRecipeButton"

const recipe: RecipeOutput = {
  id: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
  slug: "banana-bread",
  name: "Banana Bread",
  recipeIngredient: [],
  recipeInstructions: [],
}

function setShare(impl?: (data: ShareData) => Promise<void>) {
  Object.defineProperty(navigator, "share", {
    value: impl,
    configurable: true,
    writable: true,
  })
}

afterEach(() => {
  // Reset navigator.share so each test controls support explicitly.
  setShare(undefined)
  vi.restoreAllMocks()
})

describe("ShareRecipeButton", () => {
  it("does not render when navigator.share is unavailable", () => {
    render(<ShareRecipeButton recipe={recipe} />)
    expect(screen.queryByRole("button", { name: /share recipe/i })).not.toBeInTheDocument()
  })

  it("renders the share button when navigator.share is available", async () => {
    setShare(vi.fn().mockResolvedValue(undefined))
    render(<ShareRecipeButton recipe={recipe} />)
    expect(await screen.findByRole("button", { name: /share recipe/i })).toBeInTheDocument()
  })

  it("calls navigator.share with the recipe name and current URL on click", async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    setShare(share)
    render(<ShareRecipeButton recipe={recipe} />)
    const button = await screen.findByRole("button", { name: /share recipe/i })
    button.click()
    await waitFor(() =>
      expect(share).toHaveBeenCalledWith({
        title: "Banana Bread",
        url: window.location.href,
      })
    )
  })

  it("does not throw when the user dismisses the share sheet (AbortError)", async () => {
    const abort = Object.assign(new Error("dismissed"), { name: "AbortError" })
    const share = vi.fn().mockRejectedValue(abort)
    setShare(share)
    render(<ShareRecipeButton recipe={recipe} />)
    const button = await screen.findByRole("button", { name: /share recipe/i })
    button.click()
    await waitFor(() => expect(share).toHaveBeenCalled())
    // No assertion needed beyond the absence of an unhandled rejection.
  })
})

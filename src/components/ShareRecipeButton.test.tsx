import userEvent from "@testing-library/user-event"
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
  it("offers a copy-link fallback when native sharing is unavailable", () => {
    render(<ShareRecipeButton recipe={recipe} />)
    expect(screen.getByRole("button", { name: /copy recipe link/i })).toBeInTheDocument()
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

it("copies a clean recipe URL without cook state", async () => {
  const user = userEvent.setup()
  window.history.replaceState({}, "", "/recipes/abc/soup?cook=true#method")
  const copy = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue()
  render(<ShareRecipeButton recipe={recipe} />)
  await user.click(screen.getByRole("button", { name: "Copy recipe link" }))
  expect(copy).toHaveBeenCalledWith(`${window.location.origin}/recipes/abc/soup`)
  expect(screen.getByRole("status")).toHaveTextContent("Recipe link copied")
  window.history.replaceState({}, "", "/")
})
it("provides a selectable link when clipboard access fails", async () => {
  const user = userEvent.setup()
  vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("Denied"))
  render(<ShareRecipeButton recipe={recipe} />)
  await user.click(screen.getByRole("button", { name: "Copy recipe link" }))
  expect(await screen.findByRole("dialog")).toBeInTheDocument()
  expect(screen.getByRole("textbox", { name: "Recipe link" })).toHaveValue(window.location.href)
  await user.click(screen.getByRole("button", { name: "Done" }))
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
})

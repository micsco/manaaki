import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import * as currentUserHook from "../hooks/useCurrentUser"
import * as importRecipeHook from "../hooks/useImportRecipe"
import { toastManager } from "../lib/toastManager"
import * as onlineHook from "../pwa/useOnline"
import { render } from "../test/render"
import { ImportRecipeModal, normalizeRecipeUrl } from "./ImportRecipeModal"

const mockNavigate = vi.fn()
const mockCapture = vi.fn()
const mockMutateAsync = vi.fn()
const mockReset = vi.fn()

vi.mock("@tanstack/react-router", async importOriginal => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>()
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock("@posthog/react", () => ({
  usePostHog: () => ({
    capture: mockCapture,
  }),
}))

vi.mock("../lib/toastManager", () => ({
  toastManager: {
    add: vi.fn(),
  },
}))

describe("normalizeRecipeUrl", () => {
  it("returns null for empty or whitespace strings", () => {
    expect(normalizeRecipeUrl("")).toBeNull()
    expect(normalizeRecipeUrl("   ")).toBeNull()
  })

  it("returns null for invalid strings without a valid hostname", () => {
    expect(normalizeRecipeUrl("not-a-domain")).toBeNull()
    expect(normalizeRecipeUrl("ftp://example.com/recipe")).toBeNull()
  })

  it("prepends https to domain URLs without protocol", () => {
    expect(normalizeRecipeUrl("bbcgoodfood.com/recipes/curry")).toBe(
      "https://bbcgoodfood.com/recipes/curry"
    )
    expect(normalizeRecipeUrl("www.seriouseats.com/recipe")).toBe(
      "https://www.seriouseats.com/recipe"
    )
  })

  it("preserves valid http and https URLs", () => {
    expect(normalizeRecipeUrl("https://example.com/pasta")).toBe("https://example.com/pasta")
    expect(normalizeRecipeUrl("http://example.com/pasta")).toBe("http://example.com/pasta")
  })
})

describe("ImportRecipeModal", () => {
  beforeEach(() => {
    vi.spyOn(currentUserHook, "useCurrentUser").mockReturnValue({
      user: { id: "user-1", username: "chef" } as never,
      isAnonymous: false,
    })
    vi.spyOn(importRecipeHook, "useImportRecipe").mockReturnValue({
      mutateAsync: mockMutateAsync,
      reset: mockReset,
      isPending: false,
      error: null,
    } as never)
  })

  it("prefills a shared URL without automatically importing", () => {
    render(
      <ImportRecipeModal open shared initialUrl="https://youtu.be/recipe" onOpenChange={vi.fn()} />
    )
    expect(screen.getByLabelText(/recipe url/i)).toHaveValue("https://youtu.be/recipe")
    expect(mockMutateAsync).not.toHaveBeenCalled()
  })

  it("preserves the shared page through sign-in", () => {
    vi.spyOn(currentUserHook, "useCurrentUser").mockReturnValue({ user: null, isAnonymous: true })
    const returnTo = "/share?text=https%3A%2F%2Fyoutu.be%2Frecipe"
    render(<ImportRecipeModal open returnTo={returnTo} onOpenChange={vi.fn()} />)
    expect(screen.getByRole("link", { name: /sign in with mealie/i })).toHaveAttribute(
      "href",
      `/api/auth/oauth?returnTo=${encodeURIComponent(returnTo)}`
    )
  })

  it("retains the link offline and enables import after reconnecting", () => {
    const online = vi.spyOn(onlineHook, "useOnline").mockReturnValue(false)
    const { rerender } = render(
      <ImportRecipeModal open initialUrl="https://example.com/recipe" onOpenChange={vi.fn()} />
    )
    expect(screen.getByRole("button", { name: /import recipe/i })).toBeDisabled()
    expect(screen.getByText(/you’re offline/i)).toBeVisible()
    online.mockReturnValue(true)
    rerender(
      <ImportRecipeModal open initialUrl="https://example.com/recipe" onOpenChange={vi.fn()} />
    )
    expect(screen.getByRole("button", { name: /import recipe/i })).toBeEnabled()
    expect(screen.getByLabelText(/recipe url/i)).toHaveValue("https://example.com/recipe")
  })

  it("explains shares without a link", () => {
    render(<ImportRecipeModal open shared onOpenChange={vi.fn()} />)
    expect(screen.getByText(/did not include a web link/i)).toBeVisible()
  })

  it("renders nothing when closed", () => {
    render(<ImportRecipeModal open={false} onOpenChange={vi.fn()} />)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("shows sign-in CTA when user is anonymous", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    vi.spyOn(currentUserHook, "useCurrentUser").mockReturnValue({
      user: null,
      isAnonymous: true,
    })

    render(<ImportRecipeModal open={true} onOpenChange={onOpenChange} />)

    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(screen.getByText(/sign in to import recipes directly/i)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /sign in with mealie/i })).toHaveAttribute(
      "href",
      "/api/auth/oauth"
    )

    await user.click(screen.getByRole("button", { name: /cancel/i }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("renders the recipe url form when user is authenticated", () => {
    render(<ImportRecipeModal open={true} onOpenChange={vi.fn()} />)

    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(screen.getByLabelText(/recipe url/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /import recipe/i })).toBeInTheDocument()
  })

  it("captures modal open event in posthog", () => {
    render(<ImportRecipeModal open={true} onOpenChange={vi.fn()} />)
    expect(mockCapture).toHaveBeenCalledWith("recipe_import_opened")
  })

  it("shows validation error when an invalid url is submitted", async () => {
    const user = userEvent.setup()
    render(<ImportRecipeModal open={true} onOpenChange={vi.fn()} />)

    const input = screen.getByLabelText(/recipe url/i)
    await user.type(input, "just words not a url")
    await user.click(screen.getByRole("button", { name: /import recipe/i }))

    expect(screen.getByText(/please enter a valid recipe web address/i)).toBeInTheDocument()
    expect(mockMutateAsync).not.toHaveBeenCalled()
  })

  it("pastes from clipboard when paste button is clicked", async () => {
    const user = userEvent.setup()
    const mockReadText = vi.fn().mockResolvedValue("https://www.bbcgoodfood.com/recipes/pancake")
    Object.defineProperty(navigator, "clipboard", {
      value: { readText: mockReadText },
      configurable: true,
    })

    render(<ImportRecipeModal open={true} onOpenChange={vi.fn()} />)

    await user.click(screen.getByRole("button", { name: /paste/i }))
    expect(mockReadText).toHaveBeenCalled()
    expect(screen.getByLabelText(/recipe url/i)).toHaveValue(
      "https://www.bbcgoodfood.com/recipes/pancake"
    )
  })

  it("clears url input when clear button is clicked", async () => {
    const user = userEvent.setup()
    render(<ImportRecipeModal open={true} onOpenChange={vi.fn()} />)

    const input = screen.getByLabelText(/recipe url/i)
    await user.type(input, "https://example.com/recipe")
    expect(input).toHaveValue("https://example.com/recipe")

    const clearButton = screen.getByRole("button", { name: /clear url/i })
    await user.click(clearButton)
    expect(input).toHaveValue("")
  })

  it("successfully imports a recipe and navigates to the new recipe", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    mockMutateAsync.mockResolvedValue("creamy-tomato-pasta")

    render(<ImportRecipeModal open={true} onOpenChange={onOpenChange} />)

    const input = screen.getByLabelText(/recipe url/i)
    await user.type(input, "https://www.bbcgoodfood.com/recipes/pasta")
    await user.click(screen.getByRole("button", { name: /import recipe/i }))

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        url: "https://www.bbcgoodfood.com/recipes/pasta",
      })
    })

    expect(mockCapture).toHaveBeenCalledWith("recipe_import_submitted", {
      url: "https://www.bbcgoodfood.com/recipes/pasta",
    })
    expect(mockCapture).toHaveBeenCalledWith("recipe_import_succeeded", {
      url: "https://www.bbcgoodfood.com/recipes/pasta",
      slug: "creamy-tomato-pasta",
    })
    expect(toastManager.add).toHaveBeenCalledWith({
      title: "Recipe imported!",
      description: "Opening your new recipe now.",
    })
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/recipes/$slug",
      params: { slug: "creamy-tomato-pasta" },
    })
  })

  it("displays error message when mutation rejects", () => {
    mockMutateAsync.mockRejectedValue(new Error("Website blocked the scraper"))

    vi.spyOn(importRecipeHook, "useImportRecipe").mockReturnValue({
      mutateAsync: mockMutateAsync,
      reset: mockReset,
      isPending: false,
      error: new Error("Website blocked the scraper"),
    } as never)

    render(<ImportRecipeModal open={true} onOpenChange={vi.fn()} />)

    expect(screen.getByRole("alert")).toHaveTextContent("Website blocked the scraper")
  })

  it("displays loading state and disables actions when mutation is pending", () => {
    vi.spyOn(importRecipeHook, "useImportRecipe").mockReturnValue({
      mutateAsync: mockMutateAsync,
      reset: mockReset,
      isPending: true,
      error: null,
    } as never)

    render(<ImportRecipeModal open={true} onOpenChange={vi.fn()} />)

    expect(
      screen.getByText(/scraping recipe details… this may take a few seconds/i)
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /importing…/i })).toBeDisabled()
    expect(screen.getByRole("button", { name: /cancel/i })).toBeDisabled()
    expect(screen.getByLabelText(/recipe url/i)).toBeDisabled()
  })
})

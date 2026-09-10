import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import userEvent from "@testing-library/user-event"
import { act } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { getOneApiRecipesSlugGet } from "../api/generated/sdk.gen"
import type { RecipeSummary } from "../api/generated/types.gen"
import { render, screen, waitFor } from "../test/render"
import { RecipeCardTimingBadges } from "./RecipeCardTimingBadges"

vi.mock("../api/generated/sdk.gen", () => ({ getOneApiRecipesSlugGet: vi.fn() }))

const getRecipe = vi.mocked(getOneApiRecipesSlugGet)
const recipe: RecipeSummary = { id: "recipe-id", slug: "soup", totalTime: "30 minutes" }
let intersect: (visible: boolean) => void
const disconnect = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionObserverCallback) {
        intersect = visible =>
          callback(
            [{ isIntersecting: visible }] as IntersectionObserverEntry[],
            this as unknown as IntersectionObserver
          )
      }
      observe() {}
      disconnect = disconnect
    }
  )
})

afterEach(() => vi.unstubAllGlobals())

function renderBadges(value = recipe, client = new QueryClient()) {
  return render(
    <QueryClientProvider client={client}>
      <RecipeCardTimingBadges recipe={value} />
    </QueryClientProvider>
  )
}

function showCard() {
  act(() => intersect(true))
}

describe("RecipeCardTimingBadges", () => {
  it("loads nutrition only when visible and shows rounded calories beside time", async () => {
    getRecipe.mockResolvedValue({
      data: { nutrition: { calories: "450.6 kcal" }, settings: { showNutrition: true } },
    } as never)
    renderBadges({ ...recipe, recipeServings: 4 })
    expect(screen.getByText("30m")).toBeInTheDocument()
    expect(getRecipe).not.toHaveBeenCalled()
    act(() => intersect(false))
    expect(getRecipe).not.toHaveBeenCalled()
    showCard()
    expect(await screen.findByText("451")).toBeInTheDocument()
    expect(getRecipe).toHaveBeenCalledWith({ path: { slug: "recipe-id" } })
    expect(disconnect).toHaveBeenCalled()
  })

  it.each([undefined, null, "", "unknown", "Infinity", "-20"])(
    "hides unavailable or invalid calories: %s",
    async calories => {
      getRecipe.mockResolvedValue({
        data: { nutrition: { calories }, settings: { showNutrition: true } },
      } as never)
      const client = new QueryClient()
      renderBadges(recipe, client)
      showCard()
      await waitFor(() => expect(client.isFetching()).toBe(0))
      expect(screen.queryByRole("button", { name: /calories per serving/ })).not.toBeInTheDocument()
      expect(screen.getByText("30m")).toBeInTheDocument()
    }
  )

  it("respects hidden nutrition", async () => {
    getRecipe.mockResolvedValue({
      data: { nutrition: { calories: "450" }, settings: { showNutrition: false } },
    } as never)
    const client = new QueryClient()
    renderBadges(recipe, client)
    showCard()
    await waitFor(() => expect(client.isFetching()).toBe(0))
    expect(screen.queryByRole("button", { name: /calories per serving/ })).not.toBeInTheDocument()
  })

  it("shows zero calories even without a cooking time", async () => {
    getRecipe.mockResolvedValue({
      data: { nutrition: { calories: "0" }, settings: { showNutrition: true } },
    } as never)
    renderBadges({ ...recipe, totalTime: null })
    showCard()
    expect(await screen.findByText("0")).toBeInTheDocument()
    expect(screen.queryByText("30m")).not.toBeInTheDocument()
  })

  it("keeps time visible when nutrition fails to load", async () => {
    getRecipe.mockRejectedValue(new Error("Unavailable"))
    const client = new QueryClient()
    renderBadges(recipe, client)
    showCard()
    await waitFor(() => expect(client.isFetching()).toBe(0))
    expect(screen.getByText("30m")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /calories per serving/ })).not.toBeInTheDocument()
    expect(getRecipe).toHaveBeenCalledTimes(1)
  })

  it("reuses cached nutrition when remounting", async () => {
    getRecipe.mockResolvedValue({
      data: { nutrition: { calories: "450" }, settings: { showNutrition: true } },
    } as never)
    const client = new QueryClient()
    const first = renderBadges(recipe, client)
    showCard()
    await screen.findByText("450")
    first.unmount()
    renderBadges(recipe, client)
    showCard()
    expect(screen.getByText("450")).toBeInTheDocument()
    expect(getRecipe).toHaveBeenCalledTimes(1)
  })
})

it.each(["click", "hover", "keyboard"])("explains calories on %s", async interaction => {
  const user = userEvent.setup()
  getRecipe.mockResolvedValue({
    data: { nutrition: { calories: "450" }, settings: { showNutrition: true } },
  } as never)
  renderBadges()
  showCard()
  const badge = await screen.findByRole("button", { name: "450 calories per serving" })
  if (interaction === "click") await user.click(badge)
  else if (interaction === "hover") await user.hover(badge)
  else {
    await user.tab()
    await user.keyboard("{Enter}")
  }
  expect(await screen.findByRole("dialog")).toHaveTextContent("450 calories per serving")
  await user.keyboard("{Escape}")
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
})

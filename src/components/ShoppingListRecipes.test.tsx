import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it } from "vitest"
import { recipeListQueryOptions } from "../hooks/useRecipeList"
import { ShoppingListRecipes } from "./ShoppingListRecipes"

const R1 = "11111111-1111-4111-8111-111111111111"
const R2 = "22222222-2222-4222-8222-222222222222"

function wrap(recipes: unknown[]) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  qc.setQueryData(recipeListQueryOptions.queryKey, recipes as never)
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

describe("ShoppingListRecipes", () => {
  it("renders deduped, linked recipe names from refs", () => {
    render(
      <ShoppingListRecipes
        refs={[{ recipeId: R1 }, { recipeId: R1 }, { recipeId: R2 }] as never}
      />,
      {
        wrapper: wrap([
          { id: R1, name: "Soup", slug: "soup" },
          { id: R2, name: "Chilli", slug: "chilli" },
        ]),
      }
    )
    expect(screen.getByRole("link", { name: "Soup" })).toHaveAttribute(
      "href",
      expect.stringContaining("soup")
    )
    expect(screen.getByRole("link", { name: "Chilli" })).toBeInTheDocument()
    expect(screen.getAllByRole("link")).toHaveLength(2)
  })

  it("renders nothing when there are no refs", () => {
    const { container } = render(<ShoppingListRecipes refs={[]} />, { wrapper: wrap([]) })
    expect(container).toBeEmptyDOMElement()
  })
})

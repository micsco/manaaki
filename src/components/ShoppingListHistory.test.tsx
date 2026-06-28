import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import * as sdk from "../api/generated/sdk.gen"
import { ShoppingListHistory } from "./ShoppingListHistory"

vi.mock("../api/generated/sdk.gen", () => ({ getAllApiHouseholdsShoppingListsGet: vi.fn() }))

vi.mock("@tanstack/react-router", async importOriginal => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>()
  return {
    ...actual,
    Link: ({ to, search, children, ...props }: any) => {
      const qs = search ? `?${new URLSearchParams(search).toString()}` : ""
      return (
        <a href={`${to}${qs}`} {...props}>
          {children}
        </a>
      )
    },
  }
})

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

describe("ShoppingListHistory", () => {
  beforeEach(() => vi.clearAllMocks())
  it("lists previous lists with links to open them", async () => {
    vi.mocked(sdk.getAllApiHouseholdsShoppingListsGet).mockResolvedValue({
      data: {
        items: [
          { id: "l1", name: "Shop · A" },
          { id: "l2", name: "Shop · B" },
        ],
      },
    } as never)
    render(<ShoppingListHistory currentId="l1" />, { wrapper: wrap() })
    const link = await screen.findByRole("link", { name: /Shop · B/i })
    expect(link).toHaveAttribute("href", expect.stringContaining("list=l2"))
  })
})

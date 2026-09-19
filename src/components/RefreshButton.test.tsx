import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query"
import userEvent from "@testing-library/user-event"
import { beforeEach, expect, it, vi } from "vitest"

import { toastManager } from "../lib/toastManager"
import { render, screen, waitFor } from "../test/render"
import { RefreshButton } from "./RefreshButton"

vi.mock("../lib/toastManager", () => ({ toastManager: { add: vi.fn() } }))

beforeEach(() => {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true)
})

function setup(queryFn = vi.fn().mockResolvedValue("New plan")) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  client.setQueryData(["mealplan"], "Old plan")
  client.setQueryData(["recipes"], "Recipe list")
  client.setQueryData(["shopping"], "Shopping list")
  client.setQueryData(["currentUser"], "Account")
  function Page() {
    const { data } = useQuery({ queryKey: ["mealplan"], queryFn })
    return (
      <>
        <p>{data}</p>
        <RefreshButton />
      </>
    )
  }
  render(
    <QueryClientProvider client={client}>
      <Page />
    </QueryClientProvider>
  )
  return { client, queryFn }
}

it("refreshes active data and marks other lists stale without invalidating unrelated caches", async () => {
  const user = userEvent.setup()
  const { client, queryFn } = setup()
  await user.click(screen.getByRole("button", { name: "Refresh data" }))
  expect(await screen.findByText("New plan")).toBeInTheDocument()
  expect(queryFn).toHaveBeenCalledTimes(1)
  expect(client.getQueryState(["recipes"])?.isInvalidated).toBe(true)
  expect(client.getQueryState(["shopping"])?.isInvalidated).toBe(true)
  expect(client.getQueryState(["currentUser"])?.isInvalidated).toBe(false)
})

it("keeps cached content visible during refresh and prevents duplicate taps", async () => {
  const user = userEvent.setup()
  let finish!: (value: string) => void
  const { queryFn } = setup(
    vi.fn().mockReturnValue(
      new Promise<string>(resolve => {
        finish = resolve
      })
    )
  )
  await user.click(screen.getByRole("button", { name: "Refresh data" }))
  const button = screen.getByRole("button", { name: "Refreshing data" })
  expect(button).toBeDisabled()
  expect(button).toHaveAttribute("aria-busy", "true")
  expect(screen.getByText("Old plan")).toBeInTheDocument()
  await user.click(button)
  expect(queryFn).toHaveBeenCalledTimes(1)
  finish("New plan")
  expect(await screen.findByText("New plan")).toBeInTheDocument()
  await waitFor(() => expect(screen.getByRole("button", { name: "Refresh data" })).toBeEnabled())
})

it("retains displayed data and offers a retry after failure", async () => {
  const user = userEvent.setup()
  setup(vi.fn().mockRejectedValue(new Error("Unavailable")))
  await user.click(screen.getByRole("button", { name: "Refresh data" }))
  await waitFor(() =>
    expect(toastManager.add).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Couldn’t refresh" })
    )
  )
  expect(screen.getByText("Old plan")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Refresh data" })).toBeEnabled()
})

it("explains offline refresh without making requests", async () => {
  const user = userEvent.setup()
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(false)
  const { queryFn } = setup()
  await user.click(screen.getByRole("button", { name: "Refresh data" }))
  expect(queryFn).not.toHaveBeenCalled()
  expect(toastManager.add).toHaveBeenCalledWith(
    expect.objectContaining({ title: "You’re offline" })
  )
})

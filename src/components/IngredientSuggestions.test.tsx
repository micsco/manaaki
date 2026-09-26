import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { beforeEach, expect, it, vi } from "vitest"

import type { IngredientMatch } from "../api/ingredientCatalog"
import { loadFoodRecipeCount } from "../api/ingredientPopularity"
import { render, screen, waitFor } from "../test/render"
import { IngredientSuggestions } from "./IngredientSuggestions"

vi.mock("../api/ingredientPopularity", () => ({ loadFoodRecipeCount: vi.fn() }))

const items = [
  { id: "juice", name: "lime juice" },
  { id: "finger", name: "finger lime" },
  { id: "lime", name: "lime" },
  { id: "apple", name: "apple" },
]

function Editor({ popularityEnabled = true, name = "lime", onChange = vi.fn() }) {
  const [value, setValue] = useState<IngredientMatch | null>({ name })
  return (
    <>
      <IngredientSuggestions
        id="food"
        label="Food"
        items={items}
        value={value}
        userId="user"
        disabled={false}
        popularityEnabled={popularityEnabled}
        onChange={match => {
          setValue(match)
          onChange(match)
        }}
      />
      <button>Next field</button>
    </>
  )
}

beforeEach(() => {
  vi.mocked(loadFoodRecipeCount).mockImplementation(
    async id => ({ juice: 20, finger: 2, lime: 1 })[id] ?? 0
  )
})

it.each(["keyboard", "pointer"])(
  "freezes ordering and %s selection until the next field visit",
  async mode => {
    const pending = new Map<string, (count: number) => void>()
    vi.mocked(loadFoodRecipeCount).mockImplementation(
      id => new Promise(resolve => pending.set(id, resolve))
    )
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(
      <QueryClientProvider client={client}>
        <Editor onChange={onChange} />
      </QueryClientProvider>
    )
    const input = screen.getByRole("combobox", { name: "Food" })
    await user.click(input)
    const options = await screen.findAllByRole("option")
    expect(options.map(option => option.textContent)).toEqual(["lime", "finger lime", "lime juice"])
    if (mode === "keyboard") await user.keyboard("{ArrowDown}{ArrowDown}")
    else await user.hover(screen.getByRole("option", { name: "finger lime" }))
    const activeId = input.getAttribute("aria-activedescendant")
    expect(activeId).toBe(
      mode === "keyboard" ? screen.getByRole("option", { name: "finger lime" }).id : null
    )
    const list = screen.getByRole("listbox")
    list.scrollTop = 44
    await waitFor(() => expect(pending.size).toBe(3))
    pending.forEach((resolve, id) => resolve(id === "juice" ? 20 : 1))
    await waitFor(() => expect(client.isFetching()).toBe(0))
    expect(screen.getAllByRole("option")).toEqual(options)
    expect(input.getAttribute("aria-activedescendant")).toBe(activeId)
    expect(list.scrollTop).toBe(44)
    if (mode === "keyboard") await user.keyboard("{Enter}")
    else await user.click(screen.getByRole("option", { name: "finger lime" }))
    expect(onChange).toHaveBeenLastCalledWith({ id: "finger", name: "finger lime" })
    expect(input).toHaveValue("finger lime")
    await user.clear(input)
    await user.type(input, "lime")
    expect(screen.getAllByRole("option").map(option => option.textContent)).toEqual([
      "lime",
      "finger lime",
      "lime juice",
    ])
    await user.keyboard("{Escape}")
    expect(input).toHaveValue("lime")
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
    await user.click(input)
    expect(screen.getAllByRole("option").map(option => option.textContent)).toEqual([
      "lime",
      "finger lime",
      "lime juice",
    ])
    await user.keyboard("{Escape}")
    await user.click(screen.getByRole("button", { name: "Next field" }))
    await user.click(input)
    expect(screen.getAllByRole("option").map(option => option.textContent)).toEqual([
      "lime",
      "lime juice",
      "finger lime",
    ])
    expect(loadFoodRecipeCount).toHaveBeenCalledTimes(3)
  }
)

it("preserves unmatched text on Escape and blur without selecting the first option", async () => {
  const user = userEvent.setup()
  render(<Editor popularityEnabled={false} />)
  const input = screen.getByRole("combobox", { name: "Food" })
  await user.clear(input)
  await user.type(input, "li")
  expect(input).not.toHaveAttribute("aria-activedescendant")
  await user.keyboard("{Escape}")
  expect(input).toHaveValue("li")
  await user.tab()
  expect(input).toHaveValue("li")
  await user.click(input)
  await user.clear(input)
  await user.type(input, "unlisted food")
  expect(await screen.findByText("No matching suggestions")).toBeVisible()
  await user.tab()
  expect(input).toHaveValue("unlisted food")
})

it("falls back to alphabetical order when count requests fail", async () => {
  vi.mocked(loadFoodRecipeCount).mockRejectedValue(new Error("Unavailable"))
  const user = userEvent.setup()
  render(<Editor />)
  await user.click(screen.getByRole("combobox", { name: "Food" }))
  await waitFor(() => expect(loadFoodRecipeCount).toHaveBeenCalledTimes(3))
  expect(screen.getAllByRole("option").map(option => option.textContent)).toEqual([
    "lime",
    "finger lime",
    "lime juice",
  ])
})

it.each([
  { popularityEnabled: false, name: "lime" },
  { popularityEnabled: true, name: "" },
  { popularityEnabled: true, name: "l" },
])("avoids count requests for disabled or broad searches: %s", overrides => {
  render(<Editor {...overrides} />)
  expect(loadFoodRecipeCount).not.toHaveBeenCalled()
})

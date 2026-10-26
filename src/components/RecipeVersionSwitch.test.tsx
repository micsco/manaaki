import { describe, expect, it, vi } from "vitest"

import type { RecipeOutput } from "../api/generated/types.gen"
import { render, screen } from "../test/render"
import { encodeRecipeId } from "../utils/recipe"
import { RecipeVersionSwitch } from "./RecipeVersionSwitch"

const ovenId = "1133763e-1428-453c-8768-b422ea73baf0"
const airFryerId = "de0b5bf8-9d2a-4157-a1b2-35c0d37d3e0a"

vi.mock("@tanstack/react-router", () => ({
  useHydrated: () => true,
  Link: ({ to, children, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}))
vi.mock("../hooks/useRecipeList", () => ({
  useRecipeList: () => [
    { id: ovenId, slug: "bbq-potatoes", name: "BBQ potatoes" },
    { id: airFryerId, slug: "bbq-potatoes-air-fryer", name: "BBQ potatoes (Air Fryer)" },
  ],
}))

const oven: RecipeOutput = {
  id: ovenId,
  slug: "bbq-potatoes",
  name: "BBQ potatoes",
  tools: [],
  extras: { airFryerVersion: airFryerId },
}

describe("RecipeVersionSwitch", () => {
  it("marks the current method and links to the other version", () => {
    render(<RecipeVersionSwitch recipe={oven} />)
    expect(screen.getByRole("navigation", { name: "Cooking method" })).toBeInTheDocument()
    expect(screen.getByText("Oven")).toHaveAttribute("aria-current", "page")
    expect(screen.getByRole("link", { name: "Air fryer" })).toHaveAttribute(
      "href",
      `/recipes/${encodeRecipeId(airFryerId)}/bbq-potatoes-air-fryer`
    )
  })

  it("renders nothing for a recipe without a linked version", () => {
    render(<RecipeVersionSwitch recipe={{ ...oven, extras: {} }} />)
    expect(screen.queryByRole("navigation", { name: "Cooking method" })).not.toBeInTheDocument()
  })
})

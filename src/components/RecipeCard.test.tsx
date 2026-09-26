import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { expect, it, vi } from "vitest"

import { render, screen } from "../test/render"
import { RecipeCard } from "./RecipeCard"

const { capture } = vi.hoisted(() => ({ capture: vi.fn() }))
vi.mock("../contexts/AnalyticsContext", () => ({ usePostHog: () => ({ capture }) }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, onClick }: { children: ReactNode; to: string; onClick: () => void }) => (
    <a
      href={to}
      onClick={event => {
        event.preventDefault()
        onClick()
      }}
    >
      {children}
    </a>
  ),
}))
it("preserves recipe navigation, metadata and click analytics", async () => {
  render(
    <RecipeCard
      recipe={{
        id: "00000000-0000-4000-8000-000000000001",
        slug: "soup",
        name: "Soup",
        totalTime: "30 minutes",
      }}
    />
  )
  const link = screen.getByRole("link", { name: "Soup" })
  expect(link).toHaveAttribute("href", "/recipes/AAAAAAAAQACAAAAAAAAAAQ/soup")
  expect(screen.getByText("30m")).toBeInTheDocument()
  await userEvent.setup().click(link)
  expect(capture).toHaveBeenCalledWith(
    "recipe_card_clicked",
    expect.objectContaining({ recipe_id: "00000000-0000-4000-8000-000000000001" })
  )
})

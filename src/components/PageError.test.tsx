import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { expect, it, vi } from "vitest"

import { render } from "../test/render"
import { PageError } from "./PageError"

const invalidate = vi.fn()
vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({ invalidate }),
  Link: ({ children }: { children: ReactNode }) => <a href="/recipes">{children}</a>,
}))
vi.mock("../pwa/useOnline", () => ({ useOnline: () => false }))

it("explains uncached pages and offers recovery", async () => {
  render(<PageError />)
  expect(screen.getByRole("heading")).toHaveTextContent("isn’t available offline yet")
  await userEvent.click(screen.getByRole("button", { name: "Try again" }))
  expect(invalidate).toHaveBeenCalledOnce()
  expect(screen.getByRole("link", { name: "Back to recipes" })).toHaveAttribute("href", "/recipes")
})

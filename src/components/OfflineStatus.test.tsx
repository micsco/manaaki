import { act, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"

import { render } from "../test/render"
import { OfflineStatus } from "./OfflineStatus"

afterEach(() => vi.restoreAllMocks())

it("announces losing connectivity and clears the notice on reconnect", () => {
  const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(true)
  render(<OfflineStatus />)
  expect(screen.queryByRole("status")).not.toBeInTheDocument()
  online.mockReturnValue(false)
  act(() => {
    window.dispatchEvent(new Event("offline"))
  })
  expect(screen.getByRole("status")).toHaveTextContent("You’re offline")
  online.mockReturnValue(true)
  act(() => {
    window.dispatchEvent(new Event("online"))
  })
  expect(screen.queryByRole("status")).not.toBeInTheDocument()
})

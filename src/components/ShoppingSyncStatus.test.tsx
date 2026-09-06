import { act, screen } from "@testing-library/react"
import { expect, it } from "vitest"

import { receiveShoppingStatus } from "../pwa/shoppingSync"
import { render } from "../test/render"
import { ShoppingSyncStatus } from "./ShoppingSyncStatus"

it("shows pending checks and clears the status after sync", () => {
  receiveShoppingStatus(0)
  render(<ShoppingSyncStatus />)
  act(() => {
    receiveShoppingStatus(2)
  })
  expect(screen.getByRole("status")).toHaveTextContent("2 changes saved on this device")
  act(() => {
    receiveShoppingStatus(2, true)
  })
  expect(screen.getByRole("status")).toHaveTextContent("Sign in again")
  act(() => {
    receiveShoppingStatus(0)
  })
  expect(screen.queryByRole("status")).not.toBeInTheDocument()
})

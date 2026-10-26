import { act, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { toastManager } from "../lib/toastManager"
import { updateBlockers } from "../pwa/updateHolds"
import { AppToasts } from "./AppToasts"

describe("AppToasts", () => {
  it("renders without crashing", () => {
    render(<AppToasts />)
  })

  it("displays a toast added via the global toastManager", async () => {
    render(<AppToasts />)

    act(() => {
      toastManager.add({
        title: "Hello",
        description: "World",
      })
    })

    await screen.findByText("Hello")
    await screen.findByText("World")
  })

  it("renders a Reload action button when actionProps is provided", async () => {
    render(<AppToasts />)

    act(() => {
      toastManager.add({
        id: "test-action",
        title: "Update available",
        description: "A new version is ready.",
        timeout: 0,
        actionProps: { children: "Reload" },
      })
    })

    await screen.findByText("Reload")
  })

  it("does not hold back app updates while a toast is showing", async () => {
    render(<AppToasts />)
    act(() => {
      toastManager.add({ title: "Recipe imported!", timeout: 0 })
    })
    await screen.findByText("Recipe imported!")
    expect(document.querySelector('[role="dialog"], [role="alertdialog"]')).not.toBeNull()
    expect(updateBlockers("in-place")).toEqual([])
  })
})

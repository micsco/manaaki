import type { AnyRouter } from "@tanstack/react-router"
import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useVersionCheck } from "../hooks/useVersionCheck"
import { toastManager } from "../lib/toastManager"
import { applyAppUpdate } from "../pwa/client"
import { AppToasts } from "./AppToasts"

vi.mock("../pwa/client", () => ({ applyAppUpdate: vi.fn() }))

function UpdatePrompt() {
  useVersionCheck({} as AnyRouter)
  return <AppToasts />
}

afterEach(() => {
  act(() => toastManager.close("app-update-available"))
  vi.resetAllMocks()
})

describe("AppToasts", () => {
  it("acknowledges an update immediately and stays busy until the app reloads", async () => {
    const user = userEvent.setup()
    let finishUpdate!: () => void
    const update = new Promise<void>(resolve => {
      finishUpdate = resolve
    })
    vi.mocked(applyAppUpdate).mockReturnValue(update)
    render(<UpdatePrompt />)
    act(() => {
      window.dispatchEvent(new Event("pwa-update-ready"))
    })

    await user.click(await screen.findByRole("button", { name: "Update" }))
    const pending = screen.getByRole("button", { name: "Updating…" })
    expect(pending).toBeDisabled()
    expect(pending).toHaveAttribute("aria-busy", "true")
    expect(screen.getByText("Updating app…")).toBeInTheDocument()
    await user.click(pending)
    expect(applyAppUpdate).toHaveBeenCalledTimes(1)

    await act(async () => finishUpdate())
    expect(pending).toBeDisabled()
  })

  it("offers a working retry if the update cannot start", async () => {
    const user = userEvent.setup()
    vi.mocked(applyAppUpdate).mockRejectedValueOnce(new Error("Registration unavailable"))
    render(<UpdatePrompt />)
    act(() => {
      window.dispatchEvent(new Event("pwa-update-ready"))
    })

    await user.click(await screen.findByRole("button", { name: "Update" }))
    const retry = await screen.findByRole("button", { name: "Try again" })
    expect(retry).toBeEnabled()
    expect(screen.getByText("Update couldn’t start")).toBeInTheDocument()
    await user.click(retry)
    expect(applyAppUpdate).toHaveBeenCalledTimes(2)
    expect(screen.getByRole("button", { name: "Updating…" })).toBeDisabled()
  })

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
})

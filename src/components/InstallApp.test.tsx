import { act, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, expect, it, vi } from "vitest"

import { trackInstallation } from "../pwa/install"
import { render } from "../test/render"
import { InstallApp } from "./InstallApp"

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it("explains Safari installation on iPhone", () => {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue("iPhone")
  render(<InstallApp />)
  expect(screen.getByText(/In Safari, open Share/)).toBeVisible()
})

it("opens the browser install prompt only after a tap", async () => {
  const stop = trackInstallation()
  const prompt = vi.fn().mockResolvedValue(undefined)
  const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
    prompt,
    userChoice: Promise.resolve({ outcome: "dismissed" }),
  })
  render(<InstallApp />)
  act(() => {
    window.dispatchEvent(event)
  })
  expect(prompt).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole("button", { name: "Install Manaaki" }))
  expect(prompt).toHaveBeenCalledOnce()
  stop()
})

it("hides installation guidance when running standalone", () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true }))
  render(<InstallApp />)
  expect(screen.queryByRole("region", { name: "Install Manaaki" })).not.toBeInTheDocument()
})

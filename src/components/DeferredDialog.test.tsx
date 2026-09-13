import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { lazy } from "react"
import { expect, it, vi } from "vitest"

import { DeferredDialog } from "./DeferredDialog"

it("acknowledges opening and allows cancellation during download", async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  const Pending = lazy(() => new Promise<never>(() => {}))
  render(
    <DeferredDialog onClose={onClose}>
      <Pending />
    </DeferredDialog>
  )
  expect(screen.getByRole("status")).toHaveTextContent("Opening your controls")
  await user.click(screen.getByRole("button", { name: "Cancel" }))
  expect(onClose).toHaveBeenCalled()
})

it("shows the loaded controls when the module arrives", async () => {
  let finish!: (module: { default: () => React.JSX.Element }) => void
  const Pending = lazy(
    () =>
      new Promise<{ default: () => React.JSX.Element }>(resolve => {
        finish = resolve
      })
  )
  render(
    <DeferredDialog onClose={vi.fn()}>
      <Pending />
    </DeferredDialog>
  )
  await act(async () => finish({ default: () => <button>Save changes</button> }))
  expect(await screen.findByRole("button", { name: "Save changes" })).toBeVisible()
  expect(screen.queryByRole("status")).not.toBeInTheDocument()
})

it("contains download failures and offers a way to close or reload", async () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {})
  const Failed = lazy(() => Promise.reject(new Error("offline")))
  const onClose = vi.fn()
  try {
    render(
      <DeferredDialog onClose={onClose}>
        <Failed />
      </DeferredDialog>
    )
    expect(await screen.findByRole("alert")).toHaveTextContent("Check your connection")
    expect(screen.getByRole("button", { name: "Reload page" })).toBeVisible()
    await userEvent.setup().click(screen.getByRole("button", { name: "Cancel" }))
    expect(onClose).toHaveBeenCalled()
  } finally {
    error.mockRestore()
  }
})

import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

import { act, fireEvent, render, screen } from "../test/render"
import { ScrollRow } from "./ScrollRow"

let listWidth = 800
let contentWidth = 1600

beforeEach(() => {
  listWidth = 800
  contentWidth = 1600
  vi.spyOn(Element.prototype, "clientWidth", "get").mockImplementation(() => listWidth)
  vi.spyOn(Element.prototype, "scrollWidth", "get").mockImplementation(() => contentWidth)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function renderRow() {
  render(
    <ScrollRow title="Recently popular" headingId="discovery-popular">
      <li>Soup</li>
      <li>Pasta</li>
    </ScrollRow>
  )
  return screen.getByRole("list", { name: "Recently popular" })
}

function scrollTo(list: HTMLElement, left: number) {
  Object.defineProperty(list, "scrollLeft", { value: left, configurable: true })
  fireEvent.scroll(list)
}

it("labels the row with its heading", () => {
  renderRow()
  expect(screen.getByRole("region", { name: "Recently popular" })).toBeInTheDocument()
  expect(screen.getByRole("heading", { level: 2, name: "Recently popular" })).toHaveAttribute(
    "id",
    "discovery-popular"
  )
})

it("hides the arrows when every card already fits", () => {
  contentWidth = 800
  const list = renderRow()
  expect(screen.queryByRole("button", { name: /Scroll Recently popular/ })).not.toBeInTheDocument()
  expect(list).not.toHaveAttribute("data-fade")
})

it("shows arrows only on devices with a fine pointer", () => {
  renderRow()
  const arrows = screen.getByRole("button", {
    name: "Scroll Recently popular forward",
  }).parentElement
  expect(arrows).toHaveClass("hidden", "any-pointer-fine:flex")
})

it("disables the arrow for the end the row is already at and fades the other edge", () => {
  const list = renderRow()
  const back = screen.getByRole("button", { name: "Scroll Recently popular back" })
  const forward = screen.getByRole("button", { name: "Scroll Recently popular forward" })
  expect(back).toBeDisabled()
  expect(forward).toBeEnabled()
  expect(list).toHaveAttribute("data-fade", "end")

  scrollTo(list, 400)
  expect(back).toBeEnabled()
  expect(forward).toBeEnabled()
  expect(list).toHaveAttribute("data-fade", "both")

  scrollTo(list, 800)
  expect(back).toBeEnabled()
  expect(forward).toBeDisabled()
  expect(list).toHaveAttribute("data-fade", "start")
})

it("scrolls a full page of cards, including the gap, in each direction", async () => {
  const list = renderRow()
  list.style.columnGap = "24px"
  const scrollBy = vi.fn()
  list.scrollBy = scrollBy as typeof list.scrollBy
  const user = userEvent.setup()

  await user.click(screen.getByRole("button", { name: "Scroll Recently popular forward" }))
  expect(scrollBy).toHaveBeenLastCalledWith({ left: 824, behavior: "smooth" })

  scrollTo(list, 824)
  await user.click(screen.getByRole("button", { name: "Scroll Recently popular back" }))
  expect(scrollBy).toHaveBeenLastCalledWith({ left: -824, behavior: "smooth" })
})

it("jumps instead of animating when the user prefers reduced motion", async () => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === "(prefers-reduced-motion: reduce)",
  }))
  const list = renderRow()
  const scrollBy = vi.fn()
  list.scrollBy = scrollBy as typeof list.scrollBy

  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Scroll Recently popular forward" }))
  expect(scrollBy).toHaveBeenLastCalledWith({ left: 800, behavior: "auto" })
})

it("re-checks the edges when the row is resized", () => {
  let notifyResize = () => {}
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        notifyResize = callback
      }
      observe() {}
      disconnect() {}
    }
  )
  contentWidth = 800
  renderRow()
  expect(screen.queryByRole("button", { name: /Scroll Recently popular/ })).not.toBeInTheDocument()

  listWidth = 500
  act(() => notifyResize())
  expect(screen.getByRole("button", { name: "Scroll Recently popular forward" })).toBeEnabled()
})

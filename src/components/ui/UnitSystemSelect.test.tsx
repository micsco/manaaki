import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { UnitSystemSelect } from "./UnitSystemSelect"

describe("UnitSystemSelect", () => {
  it("names the current system on the trigger", () => {
    render(<UnitSystemSelect value="metric" onChange={vi.fn()} />)
    expect(screen.getByRole("combobox", { name: "Units: Metric. Tap to change" })).toBeVisible()
  })

  it("offers metric, US and as written", async () => {
    const user = userEvent.setup()
    render(<UnitSystemSelect value="metric" onChange={vi.fn()} />)

    await user.click(screen.getByRole("combobox", { name: /units/i }))
    await screen.findByRole("listbox")

    expect(screen.getAllByRole("option").map(option => option.textContent)).toEqual([
      "Metricg, ml",
      "UScups, oz",
      "As written",
    ])
  })

  it("reports the chosen system", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<UnitSystemSelect value="metric" onChange={onChange} />)

    await user.click(screen.getByRole("combobox", { name: /units/i }))
    await screen.findByRole("listbox")
    await user.click(screen.getByRole("option", { name: /as written/i }))

    expect(onChange).toHaveBeenCalledWith("as-written")
  })
})

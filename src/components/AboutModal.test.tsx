import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { MotionPermissionState } from "../hooks/useMotionPermission"
import { render } from "../test/render"
import { AboutModal } from "./AboutModal"

const mockRequestPermission = vi.fn()
let permissionState: MotionPermissionState = "granted"

vi.mock("../contexts/MotionPermissionContext", () => ({
  useMotionPermissionContext: vi.fn(() => ({
    state: permissionState,
    request: mockRequestPermission,
  })),
}))

vi.mock("../manaaki.svg?react", () => ({
  default: () => null,
}))

describe("AboutModal", () => {
  beforeEach(() => {
    permissionState = "granted"
    vi.clearAllMocks()
  })

  it("renders nothing when closed", () => {
    render(<AboutModal open={false} onOpenChange={vi.fn()} />)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("shows the dialog when open", () => {
    render(<AboutModal open={true} onOpenChange={vi.fn()} />)
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(screen.getByText("About Manaaki")).toBeInTheDocument()
  })

  it("shows a description of Manaaki", () => {
    render(<AboutModal open={true} onOpenChange={vi.fn()} />)
    expect(screen.getByText(/self-hosted recipe manager/i)).toBeInTheDocument()
  })

  it("calls onOpenChange(false) when the close button is clicked", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(<AboutModal open={true} onOpenChange={onOpenChange} />)
    await user.click(screen.getByRole("button", { name: /close/i }))
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything())
  })

  describe("when permission is prompt (iOS)", () => {
    beforeEach(() => {
      permissionState = "prompt"
    })

    it("shows the shake feature section", () => {
      render(<AboutModal open={true} onOpenChange={vi.fn()} />)
      expect(screen.getByText(/shake for a random recipe/i)).toBeInTheDocument()
    })

    it("shows the Enable shake button", () => {
      render(<AboutModal open={true} onOpenChange={vi.fn()} />)
      expect(screen.getByRole("button", { name: /enable shake/i })).toBeInTheDocument()
    })

    it("calls requestPermission and closes when Enable shake is clicked", async () => {
      const user = userEvent.setup()
      const onOpenChange = vi.fn()
      mockRequestPermission.mockResolvedValue(undefined)
      render(<AboutModal open={true} onOpenChange={onOpenChange} />)
      await user.click(screen.getByRole("button", { name: /enable shake/i }))
      expect(mockRequestPermission).toHaveBeenCalledTimes(1)
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })

  describe("when permission is granted (Android or post-approval)", () => {
    it("does not show the shake enable section", () => {
      render(<AboutModal open={true} onOpenChange={vi.fn()} />)
      expect(screen.queryByRole("button", { name: /enable shake/i })).not.toBeInTheDocument()
    })
  })

  describe("when permission is denied", () => {
    it("shows a message about re-enabling in browser settings", () => {
      permissionState = "denied"
      render(<AboutModal open={true} onOpenChange={vi.fn()} />)
      expect(screen.getByText(/browser settings/i)).toBeInTheDocument()
    })
  })

  describe("when permission is unavailable (desktop)", () => {
    it("does not show any shake-related content", () => {
      permissionState = "unavailable"
      render(<AboutModal open={true} onOpenChange={vi.fn()} />)
      expect(screen.queryByText(/shake/i)).not.toBeInTheDocument()
    })
  })
})

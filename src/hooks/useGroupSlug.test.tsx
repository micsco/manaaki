import { renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { useCurrentUser } from "./useCurrentUser"
import { useGroupSlug } from "./useGroupSlug"

vi.mock("./useCurrentUser", () => ({ useCurrentUser: vi.fn() }))

describe("useGroupSlug", () => {
  it("reads the group slug an anonymous visitor receives without a profile", () => {
    vi.mocked(useCurrentUser).mockReturnValue({ user: null, isAnonymous: true, groupSlug: "home" })
    expect(renderHook(() => useGroupSlug()).result.current).toBe("home")
  })

  it("falls back to the profile's group slug for identities cached by older builds", () => {
    vi.mocked(useCurrentUser).mockReturnValue({
      user: { groupSlug: "home" } as never,
      isAnonymous: false,
      groupSlug: null,
    })
    expect(renderHook(() => useGroupSlug()).result.current).toBe("home")
  })

  it("is undefined while the identity is loading", () => {
    vi.mocked(useCurrentUser).mockReturnValue(undefined)
    expect(renderHook(() => useGroupSlug()).result.current).toBeUndefined()
  })
})

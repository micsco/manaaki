import { beforeEach, describe, expect, it, vi } from "vitest"

import { getLoggedInUserApiUsersSelfGet, type UserOut } from "../api/generated"
import { resolveCurrentUser } from "./currentUser"
import { createMealieClient } from "./mealieClient"
import { MealieUnreachableError } from "./mealieUpstream"
import { buildSessionSetCookie } from "./session"
import { withServerTiming } from "./timing"

vi.mock("../api/generated", () => ({
  getLoggedInUserApiUsersSelfGet: vi.fn(),
}))

vi.mock("./mealieClient", () => ({
  createMealieClient: vi.fn((token: string) => ({ token })),
}))

const mockGetLoggedInUser = vi.mocked(getLoggedInUserApiUsersSelfGet)
const mockCreateMealieClient = vi.mocked(createMealieClient)
const authenticatedUser = {
  id: "user-id",
  email: "user@example.com",
  groupSlug: "home",
} as UserOut
const readOnlyUser = {
  id: "read-only-id",
  email: "readonly@example.com",
  groupSlug: "home",
} as UserOut
const anonymous = { user: null, isAnonymous: true, groupSlug: "home" }

function requestWithSession(token: string): Request {
  const cookie = buildSessionSetCookie(token, true).split(";")[0]
  return new Request("https://app/api/auth/me", {
    headers: {
      cookie,
      "x-forwarded-proto": "https",
    },
  })
}

describe("resolveCurrentUser", () => {
  beforeEach(() => {
    process.env.MEALIE_READONLY_TOKEN = "ro-token"
    process.env.SESSION_SECRET = "unit-test-secret"
  })

  it("reports a validated session as authenticated", async () => {
    mockGetLoggedInUser.mockResolvedValueOnce({ data: authenticatedUser } as never)

    await expect(resolveCurrentUser(requestWithSession("user-token"))).resolves.toEqual({
      user: authenticatedUser,
      isAnonymous: false,
      groupSlug: "home",
    })
    expect(mockCreateMealieClient).toHaveBeenCalledWith("user-token")
    expect(mockGetLoggedInUser).toHaveBeenCalledTimes(1)
  })

  it("measures identity resolution without putting account details in headers", async () => {
    mockGetLoggedInUser.mockResolvedValueOnce({ data: authenticatedUser } as never)
    const result = await withServerTiming(async () => ({
      response: Response.json(await resolveCurrentUser(requestWithSession("user-token"))),
    }))
    expect(result.response.headers.get("Server-Timing")).toMatch(
      /^identity;dur=[\d.]+, app;dur=[\d.]+$/
    )
    expect(await result.response.json()).toEqual({
      user: authenticatedUser,
      isAnonymous: false,
      groupSlug: "home",
    })
  })

  it("falls back to the read-only identity when the session is invalid", async () => {
    mockGetLoggedInUser
      .mockResolvedValueOnce({
        data: undefined,
        response: new Response(null, { status: 401 }),
      } as never)
      .mockResolvedValueOnce({ data: readOnlyUser } as never)

    await expect(resolveCurrentUser(requestWithSession("expired-token"))).resolves.toEqual(
      anonymous
    )
    expect(mockCreateMealieClient).toHaveBeenNthCalledWith(1, "expired-token")
    expect(mockCreateMealieClient).toHaveBeenNthCalledWith(2, "ro-token")
  })

  it("falls back to the read-only identity when Mealie forbids the session token", async () => {
    mockGetLoggedInUser
      .mockResolvedValueOnce({
        data: undefined,
        response: new Response(null, { status: 403 }),
      } as never)
      .mockResolvedValueOnce({ data: readOnlyUser } as never)

    await expect(resolveCurrentUser(requestWithSession("forbidden-token"))).resolves.toEqual(
      anonymous
    )
  })

  it("does not treat a transient Mealie failure as an anonymous session", async () => {
    mockGetLoggedInUser.mockResolvedValueOnce({
      data: undefined,
      response: new Response(null, { status: 503 }),
    } as never)

    await expect(resolveCurrentUser(requestWithSession("user-token"))).rejects.toBeInstanceOf(
      MealieUnreachableError
    )
    expect(mockCreateMealieClient).toHaveBeenCalledTimes(1)
  })

  it("reports a failed identity request as a Mealie failure", async () => {
    mockGetLoggedInUser.mockRejectedValueOnce(new TypeError("fetch failed"))

    await expect(resolveCurrentUser(requestWithSession("user-token"))).rejects.toBeInstanceOf(
      MealieUnreachableError
    )
  })

  it("uses only the read-only identity when there is no session", async () => {
    mockGetLoggedInUser.mockResolvedValueOnce({ data: readOnlyUser } as never)

    await expect(resolveCurrentUser(new Request("https://app/api/auth/me"))).resolves.toEqual(
      anonymous
    )
    expect(mockCreateMealieClient).toHaveBeenCalledTimes(1)
    expect(mockCreateMealieClient).toHaveBeenCalledWith("ro-token")
  })
})

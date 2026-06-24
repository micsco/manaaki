import { beforeEach, describe, expect, it, vi } from "vitest"
import { completeOidc } from "./oauth"

beforeEach(() => {
  process.env.MEALIE_INTERNAL_URL = "http://mealie:9000"
})

describe("completeOidc", () => {
  it("forwards code/state + session cookie and returns the access token", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ access_token: "mealie-jwt", token_type: "bearer" }), {
        status: 200,
      })
    )

    const token = await completeOidc(
      new Request("https://app/api/auth/complete?code=abc&state=xyz", {
        headers: { cookie: "session=mealie-session-cookie" },
      })
    )

    expect(token).toBe("mealie-jwt")
    const [input, init] = fetchMock.mock.calls[0]
    expect(String(input)).toBe("http://mealie:9000/api/auth/oauth/callback?code=abc&state=xyz")
    expect(new Headers(init?.headers).get("cookie")).toBe("session=mealie-session-cookie")
    fetchMock.mockRestore()
  })

  it("throws when Mealie returns no token", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 400 }))
    await expect(
      completeOidc(new Request("https://app/api/auth/complete?code=abc&state=xyz"))
    ).rejects.toThrow()
  })
})

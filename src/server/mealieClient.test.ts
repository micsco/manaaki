import { beforeEach, describe, expect, it, vi } from "vitest"
import { createMealieClient } from "./mealieClient"

beforeEach(() => {
  process.env.MEALIE_INTERNAL_URL = "http://mealie:9000"
})

describe("createMealieClient", () => {
  it("sends the Bearer token to the internal base URL", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }))

    const client = createMealieClient("user-token-abc")
    await client.get({ url: "/api/users/self" })

    const [request] = fetchMock.mock.calls[0]
    expect(request).toBeInstanceOf(Request)
    expect((request as Request).url).toBe("http://mealie:9000/api/users/self")
    expect((request as Request).headers.get("Authorization")).toBe("Bearer user-token-abc")
    fetchMock.mockRestore()
  })
})

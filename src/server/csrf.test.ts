import { afterEach, describe, expect, it } from "vitest"

import { handleCsrfRequest } from "./csrf"

afterEach(() => {
  delete process.env.PUBLIC_ORIGIN
})

function request(method: string, headers: Record<string, string> = {}) {
  return new Request("https://manaaki.micsco.nz/api/households/mealplans", {
    method,
    headers: {
      host: "manaaki.micsco.nz",
      "x-forwarded-proto": "https",
      ...headers,
    },
  })
}

describe("handleCsrfRequest", () => {
  it.each(["GET", "HEAD", "OPTIONS"])("allows safe %s requests unconditionally", method => {
    expect(
      handleCsrfRequest(
        request(method, {
          "sec-fetch-site": "cross-site",
          origin: "https://evil.example",
        })
      )
    ).toBeNull()
  })

  it("allows same-origin mutating requests", () => {
    expect(
      handleCsrfRequest(
        request("POST", {
          "sec-fetch-site": "same-origin",
          origin: "https://manaaki.micsco.nz",
          cookie: "__Host-manaaki_session=abc",
        })
      )
    ).toBeNull()
  })

  it.each(["cross-site", "same-site"])(
    "rejects mutating requests with Sec-Fetch-Site: %s",
    secFetchSite => {
      const response = handleCsrfRequest(
        request("POST", {
          "sec-fetch-site": secFetchSite,
          origin: "https://other.micsco.nz",
          cookie: "__Host-manaaki_session=abc",
        })
      )
      expect(response?.status).toBe(403)
      expect(response?.headers.get("cache-control")).toBe("no-store")
    }
  )

  it("rejects mutating requests with a mismatched Origin", () => {
    const response = handleCsrfRequest(
      request("DELETE", {
        origin: "https://evil.example",
        cookie: "__Host-manaaki_session=abc",
      })
    )
    expect(response?.status).toBe(403)
  })

  it("enforces PUBLIC_ORIGIN over Host header when configured", () => {
    process.env.PUBLIC_ORIGIN = "https://manaaki.micsco.nz"
    const rejected = handleCsrfRequest(
      request("POST", {
        host: "evil.example",
        origin: "https://evil.example",
      })
    )
    expect(rejected?.status).toBe(403)

    const allowed = handleCsrfRequest(
      request("POST", {
        host: "internal-proxy",
        origin: "https://manaaki.micsco.nz",
        "sec-fetch-site": "same-origin",
      })
    )
    expect(allowed).toBeNull()
  })

  it("rejects cookie-authenticated mutating requests missing both Origin and Sec-Fetch-Site", () => {
    const response = handleCsrfRequest(
      request("POST", {
        cookie: "__Host-manaaki_session=abc",
      })
    )
    expect(response?.status).toBe(403)
  })

  it("allows unauthenticated mutating requests without browser headers to reach auth handlers", () => {
    expect(handleCsrfRequest(request("POST"))).toBeNull()
  })
})

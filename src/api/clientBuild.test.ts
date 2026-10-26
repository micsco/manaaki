import { afterEach, expect, it, vi } from "vitest"

import { CLIENT_BUILD_HEADER, withClientBuild } from "./clientBuild"

afterEach(() => {
  vi.unstubAllEnvs()
})

it("adds the running build to a request and keeps its own headers", () => {
  vi.stubEnv("VITE_BUILD_GIT_SHORT_SHA", "abc1234")
  const init = withClientBuild("/api/auth/me", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  })
  const headers = new Headers(init?.headers)
  expect(init?.method).toBe("POST")
  expect(headers.get(CLIENT_BUILD_HEADER)).toBe("abc1234")
  expect(headers.get("content-type")).toBe("application/json")
})

it("keeps the headers of a Request passed without options", () => {
  vi.stubEnv("VITE_BUILD_GIT_SHORT_SHA", "abc1234")
  const request = new Request("http://localhost/api/recipes", { headers: { accept: "text/plain" } })
  const headers = new Headers(withClientBuild(request)?.headers)
  expect(headers.get("accept")).toBe("text/plain")
  expect(headers.get(CLIENT_BUILD_HEADER)).toBe("abc1234")
})

it("leaves requests alone when the build is unknown", () => {
  vi.stubEnv("VITE_BUILD_GIT_SHORT_SHA", "")
  const init = { cache: "no-store" as const }
  expect(withClientBuild("/api/auth/me", init)).toBe(init)
})

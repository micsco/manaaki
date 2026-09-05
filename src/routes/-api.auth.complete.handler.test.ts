import * as http from "node:http"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { beginNativeLogin } from "../server/nativeOidc"
import { unsealSession } from "../server/session"
import { buildKnownDeviceSetCookie, readKnownDevice } from "../server/silentLogin"
import { completeHandler } from "./api.auth.complete"

let server: http.Server
let tokenStatus = 200
let upstreamPaths: string[] = []

function startServer(): Promise<void> {
  return new Promise(resolve => {
    server = http.createServer((req, res) => {
      req.on("data", () => {})
      req.on("end", () => {
        upstreamPaths.push(req.url ?? "")
        if (req.url === "/api/users/self") {
          res.writeHead(200, { "content-type": "application/json" })
          res.end(JSON.stringify({ id: "u1", email: "mike@example.com", username: "mike" }))
          return
        }
        if (req.url === "/api/auth/oauth/native/config") {
          res.writeHead(200, { "content-type": "application/json" })
          res.end(
            JSON.stringify({
              authorization_endpoint: "https://idp.example/auth",
              client_id: "cid",
              scope: "openid email",
            })
          )
          return
        }
        res.writeHead(tokenStatus, { "content-type": "application/json" })
        res.end(JSON.stringify({ access_token: "mealie-jwt" }))
      })
    })
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as { port: number }
      process.env.MEALIE_INTERNAL_URL = `http://127.0.0.1:${port}`
      resolve()
    })
  })
}

beforeEach(async () => {
  process.env.SESSION_SECRET = "unit-test-secret"
  tokenStatus = 200
  upstreamPaths = []
  await startServer()
})

afterEach(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()))
})

async function startedLogin(query = ""): Promise<{ state: string; cookie: string }> {
  const known = buildKnownDeviceSetCookie("mike@example.com", true).split(";")[0]
  const res = await beginNativeLogin(
    new Request(`https://app/api/auth/oauth${query}`, {
      headers: { host: "manaaki.micsco.nz", "x-forwarded-proto": "https", cookie: known },
    })
  )
  const state = new URL(res.headers.get("location") ?? "").searchParams.get("state") ?? ""
  const cookie = (res.headers.getSetCookie().find(c => c.includes("manaaki_oidc=")) ?? "").split(
    ";"
  )[0]
  return { state, cookie }
}

function completeRequest(state: string, cookie: string, query = "code=abc"): Request {
  return new Request(`https://app/api/auth/complete?${query}&state=${state}`, {
    headers: { host: "manaaki.micsco.nz", "x-forwarded-proto": "https", cookie },
  })
}

function setCookies(res: Response): string[] {
  return res.headers.getSetCookie()
}

describe("completeHandler", () => {
  it("seals the Mealie token into the session cookie, clears the attempt cookie and redirects home", async () => {
    const { state, cookie } = await startedLogin()

    const res = await completeHandler(completeRequest(state, cookie))

    expect(res.status).toBe(302)
    expect(res.headers.get("location")).toBe("/recipes")
    const cookies = setCookies(res)
    const session = cookies.find(c => c.startsWith("__Host-manaaki_session="))
    expect(unsealSession(session?.split(";")[0].split("=").slice(1).join("=") ?? "")).toBe(
      "mealie-jwt"
    )
    expect(cookies.find(c => c.startsWith("__Host-manaaki_oidc="))).toContain("Max-Age=0")
  })

  it("remembers the signed-in email in the known-device cookie for later silent logins", async () => {
    const { state, cookie } = await startedLogin()

    const res = await completeHandler(completeRequest(state, cookie))

    const known = setCookies(res).find(c => c.startsWith("__Host-manaaki_known="))
    expect(known).toContain("HttpOnly")
    expect(
      readKnownDevice(
        new Request("https://app/x", {
          headers: { "x-forwarded-proto": "https", cookie: known?.split(";")[0] ?? "" },
        })
      )
    ).toEqual({ email: "mike@example.com" })
    expect(upstreamPaths).toContain("/api/users/self")
  })

  it("returns the user to where they were going", async () => {
    const { state, cookie } = await startedLogin("?returnTo=%2Fplan%3Fweek%3D2")

    const res = await completeHandler(completeRequest(state, cookie))

    expect(res.headers.get("location")).toBe("/plan?week=2")
  })

  it("ends a refused silent attempt quietly, back on the original page and still anonymous", async () => {
    const { state, cookie } = await startedLogin("?silent=1&returnTo=%2Fshopping")

    const res = await completeHandler(completeRequest(state, cookie, "error=login_required"))

    expect(res.status).toBe(302)
    expect(res.headers.get("location")).toBe("/shopping")
    const cookies = setCookies(res)
    expect(cookies.some(c => c.startsWith("__Host-manaaki_session="))).toBe(false)
    expect(cookies.find(c => c.startsWith("__Host-manaaki_oidc="))).toContain("Max-Age=0")
    expect(upstreamPaths).not.toContain("/api/auth/oauth/native/token")
  })

  it("sends a refused interactive attempt to the login error state", async () => {
    const { state, cookie } = await startedLogin()

    const res = await completeHandler(completeRequest(state, cookie, "error=access_denied"))

    expect(res.headers.get("location")).toBe("/login?error=oauth")
  })

  it("falls back to the original page when a silent exchange fails at Mealie", async () => {
    const { state, cookie } = await startedLogin("?silent=1&returnTo=%2Fplan")
    tokenStatus = 401

    const res = await completeHandler(completeRequest(state, cookie))

    expect(res.headers.get("location")).toBe("/plan")
  })

  it("redirects to the login error state and clears the attempt cookie when the exchange fails", async () => {
    const { state, cookie } = await startedLogin()
    tokenStatus = 401

    const res = await completeHandler(completeRequest(state, cookie))

    expect(res.status).toBe(302)
    expect(res.headers.get("location")).toBe("/login?error=oauth")
    const cookies = setCookies(res)
    expect(cookies.some(c => c.startsWith("__Host-manaaki_session="))).toBe(false)
    expect(cookies.find(c => c.startsWith("__Host-manaaki_oidc="))).toContain("Max-Age=0")
  })
})

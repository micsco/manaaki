import * as http from "node:http"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { beginNativeLogin } from "../server/nativeOidc"
import { unsealSession } from "../server/session"
import { completeHandler } from "./api.auth.complete"

let server: http.Server
let tokenStatus = 200

function startServer(): Promise<void> {
  return new Promise(resolve => {
    server = http.createServer((req, res) => {
      req.on("data", () => {})
      req.on("end", () => {
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
  await startServer()
})

afterEach(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()))
})

async function startedLogin(): Promise<{ state: string; cookie: string }> {
  const res = await beginNativeLogin(
    new Request("https://app/api/auth/oauth", {
      headers: { host: "manaaki.micsco.nz", "x-forwarded-proto": "https" },
    })
  )
  const state = new URL(res.headers.get("location") ?? "").searchParams.get("state") ?? ""
  const cookie = (res.headers.get("set-cookie") ?? "").split(";")[0]
  return { state, cookie }
}

function completeRequest(state: string, cookie: string): Request {
  return new Request(`https://app/api/auth/complete?code=abc&state=${state}`, {
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

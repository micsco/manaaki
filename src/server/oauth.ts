import { mealieInternalUrl } from "./env"

export async function completeOidc(request: Request): Promise<string> {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  if (!code || !state) throw new Error("Missing code/state")

  const target = new URL(`${mealieInternalUrl()}/api/auth/oauth/callback`)
  target.searchParams.set("code", code)
  target.searchParams.set("state", state)

  const headers = new Headers()
  const cookie = request.headers.get("cookie")
  if (cookie) headers.set("cookie", cookie) // carries Mealie's state/PKCE `session` cookie

  const res = await fetch(target, { headers })
  if (!res.ok) throw new Error(`OIDC callback failed: ${res.status}`)
  const body = (await res.json()) as { access_token?: string }
  if (!body.access_token) throw new Error("OIDC callback returned no access_token")
  return body.access_token
}

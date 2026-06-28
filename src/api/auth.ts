import { createServerFn } from "@tanstack/react-start"
import type { UserOut } from "./generated"

export type CurrentUser = { user: UserOut | null; isAnonymous: boolean }

// A server function: runs on the server during SSR (so the /plan and /shopping
// beforeLoad guards resolve identity from the request cookie directly, with no
// relative self-fetch that Node can't parse) and becomes an RPC when called from
// the browser. Server-only imports live inside the handler so they never enter
// the client bundle.
export const fetchCurrentUser = createServerFn().handler(async (): Promise<CurrentUser> => {
  const { getRequest } = await import("@tanstack/react-start/server")
  const { resolveCurrentUser } = await import("../server/currentUser")
  return resolveCurrentUser(getRequest())
})

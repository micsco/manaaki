import type { UserOut } from "./generated"

export type CurrentUser = { user: UserOut | null; isAnonymous: boolean }

export async function fetchCurrentUser(): Promise<CurrentUser> {
  const res = await fetch("/api/auth/me")
  if (!res.ok) return { user: null, isAnonymous: true }
  return (await res.json()) as CurrentUser
}

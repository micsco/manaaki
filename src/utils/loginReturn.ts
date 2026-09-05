export type LoginReturnSearch = { code?: string; state?: string; error?: string }

export function loginCompletionHref(search: LoginReturnSearch): string | null {
  if (!search.state) return null
  const params = new URLSearchParams()
  if (search.code) params.set("code", search.code)
  else if (search.error) params.set("error", search.error)
  else return null
  params.set("state", search.state)
  return `/api/auth/complete?${params.toString().replace(/\+/g, "%20")}`
}

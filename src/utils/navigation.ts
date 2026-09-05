export function navigationDestination(href: string): {
  to: "/plan" | "/shopping" | "/recipes"
  search: Record<string, string>
} {
  const fallback = { to: "/recipes" as const, search: {} }
  try {
    const url = new URL(href, "https://manaaki.invalid")
    if (url.origin !== "https://manaaki.invalid") return fallback
    if (url.pathname !== "/plan" && url.pathname !== "/shopping" && url.pathname !== "/recipes")
      return fallback
    return { to: url.pathname, search: Object.fromEntries(url.searchParams) }
  } catch {
    return fallback
  }
}

export function parsePlanDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T12:00:00Z`)
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : value
}

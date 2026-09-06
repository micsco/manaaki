export function validateShareSearch(search: Record<string, unknown>) {
  const field = (value: unknown) =>
    typeof value === "string" && value.length <= 16_384 ? value : ""
  return { url: field(search.url), text: field(search.text), title: field(search.title) }
}

export function sharedRecipeUrl(search: ReturnType<typeof validateShareSearch>): string {
  for (const value of [search.url, search.text, search.title]) {
    const candidates = value.match(/https?:\/\/[^\s<>"“”]+/gi) ?? []
    for (const candidate of candidates) {
      let cleaned = candidate.replace(/[.,;!?'’]+$/, "")
      while (cleaned.endsWith(")") && cleaned.split(")").length > cleaned.split("(").length) {
        cleaned = cleaned.slice(0, -1)
      }
      try {
        const url = new URL(cleaned)
        if (!url.username && !url.password && url.hostname.includes(".")) return url.href
      } catch {
        continue
      }
    }
  }
  return ""
}

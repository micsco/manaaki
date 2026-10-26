type Json = { [key: string]: unknown }

const KEEP = new Set([
  "type",
  "properties",
  "required",
  "items",
  "enum",
  "nullable",
  "format",
  "anyOf",
  "minItems",
  "maxItems",
])

export function toGeminiSchema(schema: Json): Json {
  const defs = (schema.$defs ?? schema.definitions ?? {}) as Record<string, Json>
  const convert = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(convert)
    if (!node || typeof node !== "object") return node
    const value = node as Json
    if (typeof value.$ref === "string") return convert(defs[value.$ref.split("/").at(-1) ?? ""])
    const anyOf = value.anyOf as Json[] | undefined
    if (anyOf) {
      const others = anyOf.filter(option => option.type !== "null")
      if (others.length === 1 && others.length < anyOf.length) {
        return { ...(convert(others[0]) as Json), nullable: true }
      }
    }
    if (Array.isArray(value.type)) {
      const types = value.type.filter(type => type !== "null")
      return convert({
        ...value,
        type: types[0],
        ...(types.length < value.type.length ? { nullable: true } : {}),
      })
    }
    const result: Json = {}
    for (const [key, child] of Object.entries(value)) {
      if (!KEEP.has(key)) continue
      if (key === "properties") {
        result.properties = Object.fromEntries(
          Object.entries(child as Json).map(([name, prop]) => [name, convert(prop)])
        )
      } else result[key] = convert(child)
    }
    return result
  }
  return convert(schema) as Json
}

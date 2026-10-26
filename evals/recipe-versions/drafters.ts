export type DrafterSpec = {
  label: string
  provider: "gemini" | "claude"
  model: string | null
  setting: string | null
}

const GEMINI_LEVELS = new Set(["minimal", "low", "medium", "high"])
const CLAUDE_EFFORTS = new Set(["low", "medium", "high", "xhigh", "max"])

export function parseDrafter(spec: string): DrafterSpec {
  const body = spec.trim()
  const [name, setting = null] = body.split(":")
  const suffix = setting ? ` ${setting}` : ""
  if (name === "gemini") {
    if (setting && !GEMINI_LEVELS.has(setting)) {
      throw new Error(`Unknown Gemini thinking level "${setting}" in ${spec}`)
    }
    return {
      label: `gemini${suffix || " default"}`,
      provider: "gemini",
      model: null,
      setting,
    }
  }
  if (name.startsWith("claude-")) {
    if (setting && !CLAUDE_EFFORTS.has(setting)) {
      throw new Error(`Unknown Claude effort "${setting}" in ${spec}`)
    }
    return {
      label: `${name}${suffix}`,
      provider: "claude",
      model: name,
      setting,
    }
  }
  throw new Error(`Unknown drafter "${spec}". Use gemini[:level] or claude-<model>[:effort].`)
}

export function defaultDrafters(hasClaude: boolean): string[] {
  const gemini = ["gemini:low", "gemini:medium", "gemini:high"]
  return hasClaude
    ? [...gemini, "claude-haiku-5-5", "claude-sonnet-5-5", "claude-opus-5-5"]
    : gemini
}

export function parseDrafters(value: string | undefined, hasClaude: boolean): DrafterSpec[] {
  const specs = value ? value.split(",").filter(part => part.trim()) : defaultDrafters(hasClaude)
  return specs.map(parseDrafter)
}

export function drafterEnvironment(
  drafter: DrafterSpec,
  geminiModel: string
): Record<string, string | undefined> {
  return {
    RECIPE_VERSION_MODEL:
      drafter.provider === "gemini" ? geminiModel : (drafter.model ?? undefined),
    GEMINI_THINKING_LEVEL:
      drafter.provider === "gemini" ? (drafter.setting ?? undefined) : undefined,
    CLAUDE_EFFORT: drafter.provider === "claude" ? (drafter.setting ?? undefined) : undefined,
  }
}

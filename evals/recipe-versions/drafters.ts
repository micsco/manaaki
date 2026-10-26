import { isPromptVersionName, type PromptVersionName } from "../../src/server/env"

export type DrafterSpec = {
  label: string
  provider: "gemini" | "claude"
  model: string | null
  setting: string | null
  promptVersion: PromptVersionName
}

const GEMINI_LEVELS = new Set(["minimal", "low", "medium", "high"])
const CLAUDE_EFFORTS = new Set(["low", "medium", "high", "xhigh", "max"])

export function parseDrafter(spec: string): DrafterSpec {
  const [body, version = "v2"] = spec.trim().split("@")
  if (!isPromptVersionName(version)) {
    throw new Error(`Unknown prompt version "${version}" in ${spec}`)
  }
  const [name, setting = null] = body.split(":")
  const suffix = `${setting ? ` ${setting}` : ""}${spec.includes("@") ? ` @${version}` : ""}`
  if (name === "gemini") {
    if (setting && !GEMINI_LEVELS.has(setting)) {
      throw new Error(`Unknown Gemini thinking level "${setting}" in ${spec}`)
    }
    return {
      label: `gemini${suffix || " default"}`,
      provider: "gemini",
      model: null,
      setting,
      promptVersion: version,
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
      promptVersion: version,
    }
  }
  throw new Error(
    `Unknown drafter "${spec}". Use gemini[:level][@v1|@v2|@v3] or claude-<model>[:effort][@v1|@v2|@v3].`
  )
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
    RECIPE_PROMPT_VERSION: drafter.promptVersion,
  }
}

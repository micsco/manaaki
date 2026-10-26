import {
  createDraftingModel,
  type DraftingModel,
  type ModelConfig,
} from "../../../src/server/recipeVersionModels"
import { costOf, PRICES } from "../prices"

export type { ModelConfig }

export type Keys = { gemini: string | null; claude: string | null }

export type LabelledConfig = ModelConfig & { label: string }

export function parseModel(token: string): LabelledConfig {
  const [name, setting = null] = token.trim().split(":")
  if (name === "gemini") {
    return {
      provider: "gemini",
      model: "gemini-3.8-flash",
      setting,
      label: `gemini${setting ? ` ${setting}` : ""}`,
    }
  }
  if (name.startsWith("claude-")) {
    return {
      provider: "claude",
      model: name,
      setting,
      label: `${name.replace("claude-", "").replace("-5-5", "")}${setting ? ` ${setting}` : ""}`,
    }
  }
  throw new Error(`Unknown model "${token}"`)
}

export type CostMeter = { costUsd: number | null }

export function meteredModel(config: ModelConfig, keys: Keys, meter: CostMeter): DraftingModel {
  const inner = createDraftingModel(
    config,
    (config.provider === "claude" ? keys.claude : keys.gemini) ?? ""
  )
  return {
    config,
    async structured(system, prompt, schema, hooks) {
      const result = await inner.structured(system, prompt, schema, hooks)
      const price = PRICES[config.model]?.current
      meter.costUsd =
        meter.costUsd === null || !price
          ? null
          : meter.costUsd +
            costOf(price, {
              inputTokens: result.usage.inputTokens,
              outputTokens: result.usage.outputTokens,
              thinkingTokens: result.usage.thinkingTokens ?? 0,
              firstChunkMs: null,
              firstTokenMs: null,
              modelMs: result.usage.ms,
            })
      return result
    },
  }
}

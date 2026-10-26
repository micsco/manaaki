import type { EvalUsage } from "./report"

export type Price = { input: number; output: number }

export const PRICES: Record<string, { current: Price; from2027?: Price }> = {
  "gemini-3.8-flash": {
    current: { input: 0.75, output: 3.75 },
    from2027: { input: 1.5, output: 7.5 },
  },
  "gemini-3.5-flash-lite": { current: { input: 0.3, output: 2.5 } },
  "claude-haiku-5-5": { current: { input: 0.1, output: 0.5 } },
  "claude-sonnet-5-5": { current: { input: 2, output: 10 } },
  "claude-opus-5-5": { current: { input: 4, output: 20 } },
}

export function costOf(price: Price, usage: EvalUsage): number {
  const output = usage.outputTokens + usage.thinkingTokens
  return (usage.inputTokens * price.input + output * price.output) / 1_000_000
}

export function modelCost(model: string, usage: EvalUsage): number | null {
  const price = PRICES[model]?.current
  return price ? costOf(price, usage) : null
}

export function modelCost2027(model: string, usage: EvalUsage): number | null {
  const price = PRICES[model]?.from2027 ?? PRICES[model]?.current
  return price ? costOf(price, usage) : null
}

import type { EvalUsage } from "./report"

export type Price = {
  input: number
  output: number
  cachedInput?: number
  cacheWrite?: number
  cacheWrite1h?: number
}

export const PRICES: Record<string, { current: Price; from2027?: Price }> = {
  "gemini-3.8-flash": {
    current: { input: 0.75, output: 3.75, cachedInput: 0.075 },
    from2027: { input: 1.5, output: 7.5, cachedInput: 0.15 },
  },
  "gemini-3.5-flash-lite": { current: { input: 0.3, output: 2.5 } },
  "claude-haiku-5-5": {
    current: { input: 0.1, output: 0.5, cachedInput: 0.01, cacheWrite: 0.125, cacheWrite1h: 0.2 },
  },
  "claude-sonnet-5-5": {
    current: { input: 2, output: 10, cachedInput: 0.1, cacheWrite: 2.5, cacheWrite1h: 4 },
  },
  "claude-opus-5-5": {
    current: { input: 4, output: 20, cachedInput: 0.2, cacheWrite: 5, cacheWrite1h: 8 },
  },
}

export function costOf(price: Price, usage: EvalUsage): number {
  const cached = usage.cachedInputTokens ?? 0
  const written = usage.cacheWriteTokens ?? 0
  const written1h = Math.min(usage.cacheWrite1hTokens ?? 0, written)
  const uncached = Math.max(0, usage.inputTokens - cached - written)
  const output = usage.outputTokens + usage.thinkingTokens
  return (
    (uncached * price.input +
      cached * (price.cachedInput ?? price.input) +
      (written - written1h) * (price.cacheWrite ?? price.input) +
      written1h * (price.cacheWrite1h ?? price.cacheWrite ?? price.input) +
      output * price.output) /
    1_000_000
  )
}

export function modelCost(model: string, usage: EvalUsage): number | null {
  const price = PRICES[model]?.current
  return price ? costOf(price, usage) : null
}

export function modelCost2027(model: string, usage: EvalUsage): number | null {
  const price = PRICES[model]?.from2027 ?? PRICES[model]?.current
  return price ? costOf(price, usage) : null
}

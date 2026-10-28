import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"
import { chat } from "@tanstack/ai"
import { createAnthropicChat } from "@tanstack/ai-anthropic"
import { createGeminiChat } from "@tanstack/ai-gemini"
import type { z } from "zod"

import { toGeminiSchema } from "./geminiSchema"

export type ModelConfig = {
  provider: "gemini" | "claude"
  model: string
  setting: string | null
}

export type CallUsage = {
  calls: number
  inputTokens: number
  cachedInputTokens: number
  cacheWriteTokens: number
  outputTokens: number
  thinkingTokens: number | null
  ms: number
  firstChunkMs: number | null
  firstTokenMs: number | null
}

export type CallPurpose = "draft" | "repair" | "escalation"

export type StreamHooks = {
  purpose?: CallPurpose
  signal?: AbortSignal
  onReasoning?: (delta: string) => void
  onText?: (delta: string) => void
}

export interface DraftingModel {
  config: ModelConfig
  structured<T>(
    system: string,
    prompt: string,
    schema: z.ZodType<T>,
    hooks?: StreamHooks
  ): Promise<{ data: T; usage: CallUsage }>
}

export class ModelBusyError extends Error {}

export class ModelCallError extends Error {
  constructor(
    message: string,
    readonly detail?: string
  ) {
    super(message)
  }
}

export function modelConfig(model: string, setting: string | null): ModelConfig {
  return { provider: model.startsWith("claude-") ? "claude" : "gemini", model, setting }
}

export function addUsage(total: CallUsage, part: CallUsage): CallUsage {
  return {
    calls: total.calls + part.calls,
    inputTokens: total.inputTokens + part.inputTokens,
    cachedInputTokens: total.cachedInputTokens + part.cachedInputTokens,
    cacheWriteTokens: total.cacheWriteTokens + part.cacheWriteTokens,
    outputTokens: total.outputTokens + part.outputTokens,
    thinkingTokens:
      total.thinkingTokens === null || part.thinkingTokens === null
        ? null
        : total.thinkingTokens + part.thinkingTokens,
    ms: total.ms + part.ms,
    firstChunkMs: total.firstChunkMs ?? part.firstChunkMs,
    firstTokenMs: total.firstTokenMs ?? part.firstTokenMs,
  }
}

type Usage = {
  promptTokens?: number
  promptTokensDetails?: { cachedTokens?: number; cacheWriteTokens?: number }
  completionTokens?: number
  completionTokensDetails?: { reasoningTokens?: number }
}

type Chunk = {
  type: string
  name?: string
  delta?: string
  message?: string
  value?: { object?: unknown }
  usage?: Usage
}

const BUSY = /\b(429|529)\b|RESOURCE_EXHAUSTED|overloaded|rate.?limit/i

export function createDraftingModel(config: ModelConfig, apiKey: string): DraftingModel {
  const adapter =
    config.provider === "gemini"
      ? createGeminiChat(config.model as never, apiKey)
      : createAnthropicChat(config.model as never, apiKey)
  const cachedSystem = (system: string) =>
    config.provider === "claude"
      ? [{ content: system, metadata: { cache_control: { type: "ephemeral" } } }]
      : [system]
  const modelOptions =
    config.provider === "gemini" ? { maxOutputTokens: 32000 } : { max_tokens: 32000 }
  return {
    config,
    async structured(system, prompt, schema, hooks = {}) {
      const startedAt = performance.now()
      const elapsed = () => Math.round(performance.now() - startedAt)
      const abortController = new AbortController()
      const abort = () => abortController.abort(hooks.signal?.reason)
      if (hooks.signal?.aborted) abort()
      hooks.signal?.addEventListener("abort", abort, { once: true })
      let result: unknown
      let usage: Usage | undefined
      let firstChunkMs: number | null = null
      let firstTokenMs: number | null = null
      try {
        const stream = chat({
          adapter,
          systemPrompts: cachedSystem(system),
          messages: [{ role: "user", content: prompt }],
          threadId: crypto.randomUUID(),
          outputSchema:
            config.provider === "gemini" ? toGeminiSchema(zodOutputFormat(schema).schema) : schema,
          stream: true,
          modelOptions,
          abortController,
          ...(config.setting ? { reasoning: { level: config.setting, summary: true } } : {}),
        } as never) as AsyncIterable<Chunk>
        for await (const chunk of stream) {
          if (chunk.type === "RUN_STARTED") continue
          firstChunkMs ??= elapsed()
          if (chunk.type === "REASONING_MESSAGE_CONTENT" && chunk.delta)
            hooks.onReasoning?.(chunk.delta)
          if (chunk.type === "TEXT_MESSAGE_CONTENT" && chunk.delta) {
            firstTokenMs ??= elapsed()
            hooks.onText?.(chunk.delta)
          }
          if (chunk.type === "CUSTOM" && chunk.name === "structured-output.complete") {
            result = chunk.value?.object
          }
          if (chunk.type === "RUN_ERROR") {
            const message = chunk.message ?? ""
            if (BUSY.test(message)) throw new ModelBusyError(message)
            throw new ModelCallError("The AI service returned an error.", message.slice(0, 300))
          }
          if (chunk.usage) usage = chunk.usage
        }
      } finally {
        hooks.signal?.removeEventListener("abort", abort)
      }
      if (hooks.signal?.aborted)
        throw hooks.signal.reason ?? new DOMException("Aborted", "AbortError")
      if (result === undefined)
        throw new ModelCallError("The AI stopped before finishing the draft.")
      const parsed = schema.safeParse(result)
      if (!parsed.success) {
        throw new ModelCallError(
          "The AI returned an incomplete draft.",
          parsed.error.issues[0]?.message
        )
      }
      return {
        data: parsed.data,
        usage: {
          calls: 1,
          inputTokens: usage?.promptTokens ?? 0,
          cachedInputTokens: usage?.promptTokensDetails?.cachedTokens ?? 0,
          cacheWriteTokens: usage?.promptTokensDetails?.cacheWriteTokens ?? 0,
          outputTokens: usage?.completionTokens ?? 0,
          thinkingTokens:
            config.provider === "gemini"
              ? (usage?.completionTokensDetails?.reasoningTokens ?? 0)
              : null,
          ms: elapsed(),
          firstChunkMs,
          firstTokenMs,
        },
      }
    },
  }
}

import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import process from "node:process"

import Anthropic from "@anthropic-ai/sdk"
import { GoogleGenAI } from "@google/genai"
import { describe, expect, it } from "vitest"

import type { RecipeOutput } from "../../src/api/generated/types.gen"
import { geminiModel } from "../../src/server/env"
import { generateRecipeVersionDraft } from "../../src/server/recipeVersionAi"
import { checkDraft } from "../../src/utils/recipeVersionDraft"
import { caseInput } from "./caseInput"
import { EVAL_CASES } from "./cases"
import { drafterEnvironment, parseDrafters } from "./drafters"
import { claudeJudge, geminiJudge, type Judge } from "./judge"
import { type PipelineSpec, parsePipeline, runPipeline } from "./pipelines"
import { modelCost, modelCost2027 } from "./prices"
import { type EvalRun, renderReport, summarise } from "./report"

function loadEnv() {
  const mainCheckout = dirname(
    execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], {
      encoding: "utf8",
    }).trim()
  )
  for (const file of [resolve(".env"), join(mainCheckout, ".env")]) {
    if (existsSync(file)) {
      process.loadEnvFile(file)
      return file
    }
  }
  return null
}

const envFile = loadEnv()
const claudeKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY
const geminiKey = process.env.GEMINI_API_KEY
const specs = process.env.EVAL_DRAFTERS?.split(",").filter(part => part.trim()) ?? []
const pipelineSpecs = specs.filter(spec => spec.includes("/")).map(parsePipeline)
const drafterSpecs = specs.filter(spec => !spec.includes("/"))
const drafters =
  specs.length && !drafterSpecs.length
    ? []
    : parseDrafters(drafterSpecs.length ? drafterSpecs.join(",") : undefined, Boolean(claudeKey))
type Entry =
  | { label: string; kind: "drafter"; drafter: (typeof drafters)[number] }
  | { label: string; kind: "pipeline"; pipeline: PipelineSpec }
const entries: Entry[] = [
  ...drafters.map(drafter => ({ label: drafter.label, kind: "drafter" as const, drafter })),
  ...pipelineSpecs.map(pipeline => ({
    label: pipeline.label,
    kind: "pipeline" as const,
    pipeline,
  })),
]
const pipelineModels = pipelineSpecs.flatMap(spec =>
  spec.kind === "structured" && spec.escalate ? [spec.model, spec.escalate] : [spec.model]
)
const caseFilter = process.env.EVAL_CASES?.split(",").map(slug => slug.trim())
const cases = EVAL_CASES.filter(example => !caseFilter || caseFilter.includes(example.slug))
const repeats = Math.max(1, Number(process.env.EVAL_REPEATS ?? 1))
const useJudge = process.env.EVAL_JUDGE !== "0"
const recipeSource = process.env.EVAL_RECIPE_SOURCE ?? "https://manaaki.micsco.nz"
const concurrency = Math.max(1, Number(process.env.EVAL_CONCURRENCY ?? 3))
const needsGemini =
  drafters.some(drafter => drafter.provider === "gemini") ||
  pipelineModels.some(model => model.provider === "gemini")
const needsClaude =
  drafters.some(drafter => drafter.provider === "claude") ||
  pipelineModels.some(model => model.provider === "claude")
const ready = (!needsGemini || Boolean(geminiKey)) && (!needsClaude || Boolean(claudeKey))

async function fetchRecipe(slug: string): Promise<RecipeOutput> {
  const response = await fetch(`${recipeSource}/api/recipes/${encodeURIComponent(slug)}`)
  if (!response.ok) throw new Error(`Couldn't load ${slug}: ${response.status}`)
  return (await response.json()) as RecipeOutput
}

async function inBatches<T>(items: T[], size: number, work: (item: T) => Promise<void>) {
  for (let index = 0; index < items.length; index += size) {
    await Promise.all(items.slice(index, index + size).map(work))
  }
}

function pickJudge(gemini: GoogleGenAI | null, claude: Anthropic | null): Judge | null {
  if (!useJudge) return null
  const model = process.env.EVAL_JUDGE_MODEL || (claude ? "claude-opus-5-5" : geminiModel())
  if (model.startsWith("claude-")) {
    if (!claude) throw new Error("EVAL_JUDGE_MODEL is a Claude model but CLAUDE_API_KEY isn't set.")
    return claudeJudge(claude, model)
  }
  if (!gemini) throw new Error("A Gemini judge needs GEMINI_API_KEY.")
  return geminiJudge(gemini, model)
}

describe.skipIf(!ready)("recipe version eval (live models)", () => {
  it("drafts every case with every drafter and writes a report", async () => {
    const gemini = geminiKey ? new GoogleGenAI({ apiKey: geminiKey }) : null
    const claude = claudeKey ? new Anthropic({ apiKey: claudeKey }) : null
    const judge = pickJudge(gemini, claude)
    const drafts = cases.length * entries.length * repeats
    console.info(
      `Eval: ${cases.length} recipes × ${entries.length} drafters (${entries.map(d => d.label).join(", ")}) × ${repeats} = ${drafts} drafts${
        judge ? `, plus ${drafts} judge calls with ${judge.label}` : ""
      }. Keys from ${envFile ?? "the environment"}.`
    )
    const recipes = new Map<string, RecipeOutput>()
    for (const slug of new Set(
      cases.flatMap(example => [
        example.slug,
        ...(example.referenceSlug ? [example.referenceSlug] : []),
      ])
    ))
      recipes.set(slug, await fetchRecipe(slug))

    const runs: EvalRun[] = []
    const baseGeminiModel = geminiModel()
    for (const entry of entries) {
      if (entry.kind === "drafter") {
        for (const [name, value] of Object.entries(
          drafterEnvironment(entry.drafter, baseGeminiModel)
        )) {
          if (value === undefined) delete process.env[name]
          else process.env[name] = value
        }
      }
      const jobs = cases.flatMap(example =>
        Array.from({ length: repeats }, (_, repeat) => ({ example, repeat }))
      )
      await inBatches(jobs, concurrency, async ({ example, repeat }) => {
        const recipe = recipes.get(example.slug)!
        const input = caseInput(
          example,
          recipe,
          example.referenceSlug ? recipes.get(example.referenceSlug)! : null
        )
        const run: EvalRun = {
          slug: example.slug,
          name: recipe.name ?? example.slug,
          target: example.target,
          drafter: entry.label,
          repeat,
        }
        runs.push(run)
        try {
          const { recipe: draftRecipe, source, reference } = input
          let draft
          if (entry.kind === "pipeline") {
            const result = await runPipeline(
              { gemini: geminiKey ?? null, claude: claudeKey ?? null },
              entry.pipeline,
              {
                recipe: draftRecipe,
                target: example.target,
                source,
              }
            )
            draft = result.draft
            run.usage = {
              inputTokens: result.usage.inputTokens,
              outputTokens: result.usage.outputTokens,
              thinkingTokens: result.usage.thinkingTokens ?? 0,
              firstChunkMs: null,
              firstTokenMs: null,
              modelMs: result.usage.ms,
            }
            run.costUsd = result.costUsd
            run.pipeline = {
              calls: result.usage.calls,
              repairRan: result.repairRan,
              repairFixed: result.repairFixed,
              escalated: result.escalated,
              escalationFixed: result.escalationFixed,
              initialFindings: result.initialFindings,
            }
          } else {
            const result = await generateRecipeVersionDraft({
              recipe: draftRecipe,
              source,
              target: example.target,
              notes: "",
            })
            draft = result.draft
            const usage = { ...result.usage, thinkingTokens: result.usage.thinkingTokens ?? 0 }
            run.usage = usage
            run.costUsd = modelCost(result.usage.model, usage)
            run.costUsd2027 = modelCost2027(result.usage.model, usage)
          }
          run.draft = draft
          run.checks = checkDraft(draft, source, example.target)
          if (judge) {
            run.verdict = await judge
              .grade(draftRecipe, example.target, draft, reference)
              .catch(failure => {
                run.judgeError = failure instanceof Error ? failure.message : String(failure)
                return undefined
              })
          }
        } catch (failure) {
          run.error = failure instanceof Error ? failure.message : String(failure)
        }
        console.info(
          `${entry.label.padEnd(20)} ${example.slug} → ${example.target}: ${
            run.error
              ? `failed (${run.error})`
              : `${(run.usage!.modelMs / 1000).toFixed(1)} s, ${run.usage!.thinkingTokens} thinking, overall ${run.verdict?.overall ?? "–"}/5`
          }`
        )
      })
    }

    const stamp = new Date().toISOString().replaceAll(":", "-").slice(0, 19)
    const directory = resolve("evals/results", stamp)
    mkdirSync(directory, { recursive: true })
    const labels = entries.map(entry => entry.label)
    const meta = {
      date: new Date().toISOString(),
      gemini: geminiModel(),
      judge: judge?.label ?? "off",
      drafters: labels.join(", "),
      repeats: String(repeats),
    }
    writeFileSync(join(directory, "results.json"), JSON.stringify({ meta, runs }, null, 2))
    writeFileSync(join(directory, "report.html"), renderReport(runs, labels, meta))
    console.table(
      summarise(runs, labels).map(summary => ({
        drafter: summary.drafter,
        failed: summary.failures,
        "median s":
          summary.medianModelMs === null ? "–" : (summary.medianModelMs / 1000).toFixed(1),
        "median thinking": summary.medianThinkingTokens,
        "must-fix": summary.blocking,
        warnings: summary.warnings,
        overall: summary.meanOverall?.toFixed(2) ?? "–",
        "$/draft": summary.meanCostUsd?.toFixed(4) ?? "–",
      }))
    )
    console.info(`Report: ${join(directory, "report.html")}`)
    expect(runs.length).toBe(drafts)
  })
})

describe.skipIf(ready)("recipe version eval", () => {
  it("needs API keys in .env", () => {
    console.info(
      "Skipped: add GEMINI_API_KEY (and CLAUDE_API_KEY for Claude drafters or judge) to .env to run the eval."
    )
  })
})

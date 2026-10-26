import type { DraftCheck, RecipeVersionDraft } from "../../src/utils/recipeVersionDraft"
import type { CookingMethod } from "../../src/utils/recipeVersions"
import { CRITERIA, ISSUE_CATEGORIES, type IssueCategory, type JudgeVerdict } from "./judge"

export type EvalUsage = {
  inputTokens: number
  outputTokens: number
  thinkingTokens: number
  firstChunkMs: number | null
  firstTokenMs: number | null
  modelMs: number
}

export type EvalRun = {
  slug: string
  name: string
  target: CookingMethod
  drafter: string
  repeat: number
  error?: string
  draft?: RecipeVersionDraft
  checks?: DraftCheck[]
  verdict?: JudgeVerdict
  judgeError?: string
  usage?: EvalUsage
  costUsd?: number | null
  costUsd2027?: number | null
  pipeline?: {
    calls: number
    repairRan: boolean
    repairFixed: boolean
    escalated: boolean
    escalationFixed: boolean
    initialFindings: number
  }
}

export type DrafterSummary = {
  drafter: string
  drafts: number
  failures: number
  blocking: number
  warnings: number
  medianModelMs: number | null
  medianFirstTokenMs: number | null
  medianThinkingTokens: number | null
  meanOverall: number | null
  meanScores: Record<string, number | null>
  meanCostUsd: number | null
  meanCostUsd2027: number | null
  meanCalls: number | null
  repairsRan: number
  repairsFixed: number
  escalations: number
  escalationsFixed: number
  issuesPerDraft: Record<IssueCategory, number | null>
  versusFirst: { wins: number; losses: number; ties: number } | null
}

function overallByRecipe(runs: EvalRun[], drafter: string): Map<string, number> {
  const scores = new Map<string, number[]>()
  for (const run of runs) {
    if (run.drafter !== drafter || !run.verdict) continue
    const key = `${run.slug}:${run.target}`
    scores.set(key, [...(scores.get(key) ?? []), run.verdict.overall])
  }
  return new Map([...scores].map(([key, values]) => [key, mean(values)!]))
}

export function headToHead(runs: EvalRun[], baseline: string, challenger: string) {
  const base = overallByRecipe(runs, baseline)
  const tally = { wins: 0, losses: 0, ties: 0 }
  for (const [key, score] of overallByRecipe(runs, challenger)) {
    const against = base.get(key)
    if (against === undefined) continue
    if (score > against) tally.wins += 1
    else if (score < against) tally.losses += 1
    else tally.ties += 1
  }
  return tally
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

export function mean(values: number[]): number | null {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
}

export function summarise(runs: EvalRun[], drafters: string[]): DrafterSummary[] {
  return drafters.map(drafter => {
    const forLevel = runs.filter(run => run.drafter === drafter)
    const ok = forLevel.filter(run => run.draft && run.usage)
    const judged = ok.flatMap(run => (run.verdict ? [run.verdict] : []))
    const costs = ok.flatMap(run => (typeof run.costUsd === "number" ? [run.costUsd] : []))
    const costs2027 = ok.flatMap(run =>
      typeof run.costUsd2027 === "number" ? [run.costUsd2027] : []
    )
    return {
      drafter,
      drafts: forLevel.length,
      failures: forLevel.length - ok.length,
      blocking: ok.reduce(
        (sum, run) => sum + (run.checks ?? []).filter(c => c.level === "block").length,
        0
      ),
      warnings: ok.reduce(
        (sum, run) => sum + (run.checks ?? []).filter(c => c.level === "warn").length,
        0
      ),
      medianModelMs: median(ok.map(run => run.usage!.modelMs)),
      medianFirstTokenMs: median(
        ok.flatMap(run => (run.usage!.firstTokenMs === null ? [] : [run.usage!.firstTokenMs]))
      ),
      medianThinkingTokens: median(ok.map(run => run.usage!.thinkingTokens)),
      meanOverall: mean(judged.map(verdict => verdict.overall)),
      meanScores: Object.fromEntries(
        CRITERIA.map(name => [name, mean(judged.map(verdict => verdict.scores[name]))])
      ),
      meanCostUsd: costs.length === ok.length ? mean(costs) : null,
      meanCostUsd2027: costs2027.length === ok.length ? mean(costs2027) : null,
      meanCalls: mean(ok.map(run => run.pipeline?.calls ?? 1)),
      repairsRan: ok.filter(run => run.pipeline?.repairRan).length,
      repairsFixed: ok.filter(run => run.pipeline?.repairFixed).length,
      escalations: ok.filter(run => run.pipeline?.escalated).length,
      escalationsFixed: ok.filter(run => run.pipeline?.escalationFixed).length,
      issuesPerDraft: Object.fromEntries(
        ISSUE_CATEGORIES.map(category => [
          category,
          judged.length
            ? judged.reduce(
                (sum, verdict) =>
                  sum + verdict.issues.filter(issue => issue.category === category).length,
                0
              ) / judged.length
            : null,
        ])
      ) as Record<IssueCategory, number | null>,
      versusFirst: drafter === drafters[0] ? null : headToHead(runs, drafters[0], drafter),
    }
  })
}

export function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

const number = (value: number | null, digits = 0) => (value === null ? "–" : value.toFixed(digits))
const seconds = (ms: number | null) => (ms === null ? "–" : `${(ms / 1000).toFixed(1)} s`)

function summaryTable(summaries: DrafterSummary[]): string {
  const rows: [string, (s: DrafterSummary) => string][] = [
    ["Drafts (failed)", s => `${s.drafts} (${s.failures})`],
    ["Median total model time", s => seconds(s.medianModelMs)],
    ["Median time to first word", s => seconds(s.medianFirstTokenMs)],
    ["Median thinking tokens", s => number(s.medianThinkingTokens)],
    ["Mean cost per draft", s => (s.meanCostUsd === null ? "–" : `$${s.meanCostUsd.toFixed(4)}`)],
    [
      "Mean cost from 2027",
      s => (s.meanCostUsd2027 === null ? "–" : `$${s.meanCostUsd2027.toFixed(4)}`),
    ],
    [
      "Cost per 100 drafts",
      s => (s.meanCostUsd === null ? "–" : `$${(s.meanCostUsd * 100).toFixed(2)}`),
    ],
    ["Model calls per draft", s => number(s.meanCalls, 1)],
    ["Repairs ran (fixed)", s => `${s.repairsRan} (${s.repairsFixed})`],
    ["Escalations (fixed)", s => `${s.escalations} (${s.escalationsFixed})`],
    ["Must-fix checks", s => String(s.blocking)],
    ["Warnings", s => String(s.warnings)],
    ["Mean overall score", s => number(s.meanOverall, 2)],
    [
      "Recipes better / worse / same as the first",
      s =>
        s.versusFirst
          ? `${s.versusFirst.wins} / ${s.versusFirst.losses} / ${s.versusFirst.ties}`
          : "–",
    ],
    ...CRITERIA.map(
      name =>
        [`Mean ${name}`, (s: DrafterSummary) => number(s.meanScores[name], 2)] as [
          string,
          (s: DrafterSummary) => string,
        ]
    ),
    ...ISSUE_CATEGORIES.map(
      category =>
        [
          `Issues per draft: ${category}`,
          (s: DrafterSummary) => number(s.issuesPerDraft[category], 2),
        ] as [string, (s: DrafterSummary) => string]
    ),
  ]
  return `<table><thead><tr><th></th>${summaries.map(s => `<th>${escapeHtml(s.drafter)}</th>`).join("")}</tr></thead><tbody>${rows
    .map(
      ([label, cell]) =>
        `<tr><th>${escapeHtml(label)}</th>${summaries.map(s => `<td>${escapeHtml(cell(s))}</td>`).join("")}</tr>`
    )
    .join("")}</tbody></table>`
}

function runCell(run: EvalRun | undefined): string {
  if (!run) return "<td>–</td>"
  if (run.error) return `<td class="bad">Failed: ${escapeHtml(run.error)}</td>`
  const checks = (run.checks ?? [])
    .map(check => `<li class="${check.level}">${escapeHtml(check.message)}</li>`)
    .join("")
  const issues = (run.verdict?.issues ?? [])
    .map(
      issue =>
        `<li><span class="muted">${escapeHtml(issue.category)}</span> ${escapeHtml(issue.text)}</li>`
    )
    .join("")
  const steps = (run.draft?.steps ?? []).map(step => `<li>${escapeHtml(step)}</li>`).join("")
  return `<td>
    <p><strong>${number(run.verdict?.overall ?? null)}/5</strong> · ${seconds(run.usage?.modelMs ?? null)} · ${number(run.usage?.thinkingTokens ?? null)} thinking · confidence ${escapeHtml(run.draft?.confidence)}${run.pipeline ? ` · ${run.pipeline.calls} calls${run.pipeline.repairRan ? ` · repaired${run.pipeline.repairFixed ? "" : " (still failing)"}` : ""}${run.pipeline.escalated ? ` · escalated${run.pipeline.escalationFixed ? "" : " (still failing)"}` : ""}` : ""}${typeof run.costUsd === "number" ? ` · $${run.costUsd.toFixed(4)}` : ""}</p>
    <p class="muted">${CRITERIA.map(name => `${name} ${run.verdict?.scores[name] ?? "–"}`).join(" · ")}${run.judgeError ? ` · judge failed: ${escapeHtml(run.judgeError)}` : ""}</p>
    ${checks ? `<ul class="checks">${checks}</ul>` : ""}
    ${issues ? `<p>Judge's issues:</p><ul>${issues}</ul>` : ""}
    <details><summary>${escapeHtml(run.draft?.name)} — prep ${run.draft?.prepMinutes}, cook ${run.draft?.cookMinutes}, total ${run.draft?.totalMinutes} min</summary><ol>${steps}</ol></details>
  </td>`
}

export function renderReport(
  runs: EvalRun[],
  drafters: string[],
  meta: Record<string, string>
): string {
  const cases = [...new Map(runs.map(run => [`${run.slug}:${run.target}`, run])).values()]
  const sections = cases
    .map(example => {
      const repeats = Math.max(
        ...runs
          .filter(run => run.slug === example.slug && run.target === example.target)
          .map(run => run.repeat)
      )
      const rows = Array.from(
        { length: repeats + 1 },
        (_, repeat) =>
          `<tr>${drafters.map(drafter => runCell(runs.find(run => run.slug === example.slug && run.target === example.target && run.drafter === drafter && run.repeat === repeat))).join("")}</tr>`
      ).join("")
      return `<section><h2>${escapeHtml(example.name)} → ${escapeHtml(example.target)}</h2><table class="runs"><thead><tr>${drafters.map(drafter => `<th>${escapeHtml(drafter)}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></section>`
    })
    .join("")
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Recipe version eval</title>
<style>
:root{color-scheme:light dark;--bg:#fff;--fg:#1a1a1a;--muted:#666;--line:#ddd;--bad:#b42318;--warn:#a15c00}
@media (prefers-color-scheme:dark){:root{--bg:#111;--fg:#eee;--muted:#999;--line:#333;--bad:#f97066;--warn:#fdb022}}
body{background:var(--bg);color:var(--fg);font:14px/1.5 system-ui,sans-serif;margin:0 auto;max-width:1400px;padding:16px}
table{border-collapse:collapse;width:100%;margin:8px 0 24px}th,td{border:1px solid var(--line);padding:8px;text-align:left;vertical-align:top}
.runs td{width:${Math.floor(100 / Math.max(drafters.length, 1))}%}.muted{color:var(--muted)}.bad,.block{color:var(--bad)}.warn{color:var(--warn)}ul,ol{margin:4px 0;padding-left:20px}
</style></head><body><h1>Recipe version eval</h1><p class="muted">${Object.entries(meta)
    .map(([key, value]) => `${escapeHtml(key)}: ${escapeHtml(value)}`)
    .join(" · ")}</p>
<h2>Summary by drafter</h2>${summaryTable(summarise(runs, drafters))}${sections}</body></html>`
}

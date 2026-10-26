import { findFunction, type HouseholdAppliance } from "./householdAppliances"

export type PlanStage = {
  zone: string | null
  function: string
  setting: string | null
  minutes: number
  alongsidePrevious: boolean
  what: string
}

const SETTING_NAMES: Record<string, string> = { lo: "lo", low: "lo", hi: "hi", high: "hi" }

function celsius(setting: string | null): number | null {
  const match = setting ? /(\d{2,3})\s*°?\s*C\b/i.exec(setting) : null
  return match ? Number(match[1]) : null
}

function describe(stage: PlanStage): string {
  return [stage.zone, stage.function, stage.setting].filter(Boolean).join(" ")
}

export function validatePlan(stages: PlanStage[], appliance: HouseholdAppliance | null): string[] {
  const problems: string[] = []
  stages.forEach((stage, index) => {
    if (!Number.isFinite(stage.minutes) || stage.minutes <= 0) {
      problems.push(`Stage ${index + 1} (${describe(stage)}) needs a positive time.`)
      return
    }
    if (index === 0 && stage.alongsidePrevious) {
      problems.push("The first stage can't run alongside a previous one.")
    }
    const fn = appliance ? findFunction(appliance, stage.function) : null
    if (!fn) return
    const label = `${fn.name}${stage.setting ? ` ${stage.setting}` : ""}`
    if (fn.settings) {
      const key = SETTING_NAMES[(stage.setting ?? "").trim().toLowerCase()]
      if (!key || !(key in fn.settings)) {
        problems.push(
          `${fn.name} needs one of these settings: ${Object.keys(fn.settings).join(", ").toUpperCase()}.`
        )
        return
      }
      const range = fn.settings[key]
      if (range && (stage.minutes < range.minMinutes || stage.minutes > range.maxMinutes)) {
        problems.push(
          `${label} for ${stage.minutes} min is outside ${range.minMinutes}–${range.maxMinutes} min.`
        )
      }
    }
    if (fn.minMinutes !== undefined && stage.minutes < fn.minMinutes) {
      problems.push(
        `${label} for ${stage.minutes} min is shorter than its ${fn.minMinutes} min minimum.`
      )
    }
    if (fn.maxMinutes !== undefined && stage.minutes > fn.maxMinutes) {
      problems.push(
        `${label} for ${stage.minutes} min is longer than its ${fn.maxMinutes} min maximum.`
      )
    }
    const temperature = celsius(stage.setting)
    if (
      temperature !== null &&
      fn.fixedTemperature !== undefined &&
      temperature !== fn.fixedTemperature
    ) {
      problems.push(`${fn.name} is fixed at ${fn.fixedTemperature}°C, not ${temperature}°C.`)
    }
    if (
      temperature !== null &&
      fn.temperature &&
      (temperature < fn.temperature[0] || temperature > fn.temperature[1])
    ) {
      problems.push(
        `${fn.name} at ${temperature}°C is outside ${fn.temperature[0]}–${fn.temperature[1]}°C.`
      )
    }
  })
  return problems
}

export function planCookMinutes(stages: PlanStage[]): number {
  let total = 0
  let group = 0
  for (const stage of stages) {
    if (stage.alongsidePrevious) group = Math.max(group, stage.minutes)
    else {
      total += group
      group = stage.minutes
    }
  }
  return total + group
}

export function planTimes(stages: PlanStage[], prepMinutes: number, waitingMinutes: number) {
  const cookMinutes = planCookMinutes(stages)
  return { prepMinutes, cookMinutes, totalMinutes: prepMinutes + cookMinutes + waitingMinutes }
}

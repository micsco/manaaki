import type { CreateIngredientUnit, IngredientUnitOutput } from "../api/generated/types.gen"

export type UnitSystem = "metric" | "us"
export type UnitPreference = UnitSystem | "as-written"

export const DEFAULT_UNIT_PREFERENCE: UnitPreference = "metric"
export const UNIT_PREFERENCES: readonly UnitPreference[] = ["metric", "us", "as-written"]
const UNIT_SYSTEMS: readonly UnitSystem[] = ["metric", "us"]

export type IngredientUnit = IngredientUnitOutput | CreateIngredientUnit

export type Amount = {
  quantity?: number | null
  unit?: IngredientUnit | null
}

type Dimension = "mass" | "volume"

type StandardUnit = {
  dimension: Dimension
  baseAmount: number
  customary: boolean
}

const STANDARD_UNITS: Record<string, StandardUnit> = {
  fluid_ounce: { dimension: "volume", baseAmount: 29.5735295625, customary: true },
  cup: { dimension: "volume", baseAmount: 236.5882365, customary: true },
  ounce: { dimension: "mass", baseAmount: 28.349523125, customary: true },
  pound: { dimension: "mass", baseAmount: 453.59237, customary: true },
  milliliter: { dimension: "volume", baseAmount: 1, customary: false },
  liter: { dimension: "volume", baseAmount: 1000, customary: false },
  gram: { dimension: "mass", baseAmount: 1, customary: false },
  kilogram: { dimension: "mass", baseAmount: 1000, customary: false },
}

type DisplayUnit = {
  name: string
  pluralName: string
  abbreviation: string
  pluralAbbreviation?: string
  useAbbreviation: boolean
  baseAmount: number
  takeoverAt: number
  fraction: boolean
}

const DISPLAY_UNITS: Record<UnitSystem, Record<Dimension, DisplayUnit[]>> = {
  metric: {
    mass: [
      metricUnit({ name: "gram", pluralName: "grams", abbreviation: "g", baseAmount: 1 }),
      metricUnit({
        name: "kilogram",
        pluralName: "kilograms",
        abbreviation: "kg",
        baseAmount: 1000,
      }),
    ],
    volume: [
      metricUnit({
        name: "millilitre",
        pluralName: "millilitres",
        abbreviation: "ml",
        baseAmount: 1,
      }),
      {
        ...metricUnit({ name: "litre", pluralName: "litres", abbreviation: "l", baseAmount: 1000 }),
        useAbbreviation: false,
      },
    ],
  },
  us: {
    mass: [
      usUnit({ name: "ounce", pluralName: "ounces", abbreviation: "oz", baseAmount: 28.349523125 }),
      {
        ...usUnit({
          name: "pound",
          pluralName: "pounds",
          abbreviation: "lb",
          baseAmount: 453.59237,
        }),
        pluralAbbreviation: "lbs",
      },
    ],
    volume: [
      usUnit({
        name: "teaspoon",
        pluralName: "teaspoons",
        abbreviation: "tsp",
        baseAmount: 4.92892159375,
      }),
      usUnit({
        name: "tablespoon",
        pluralName: "tablespoons",
        abbreviation: "tbsp",
        baseAmount: 14.78676478125,
      }),
      {
        ...usUnit({ name: "cup", pluralName: "cups", abbreviation: "c", baseAmount: 236.5882365 }),
        useAbbreviation: false,
        takeoverAt: 0.25,
      },
      usUnit({ name: "quart", pluralName: "quarts", abbreviation: "qt", baseAmount: 946.352946 }),
      usUnit({
        name: "gallon",
        pluralName: "gallons",
        abbreviation: "gal",
        baseAmount: 3785.411784,
      }),
    ],
  },
}

const LARGEST_SPOON_MEASURE_ML = 15
const DECIMAL_TOLERANCE = 0.025
const FRACTION_TOLERANCE = 0.05
const DECIMAL_STEPS = [1, 2, 5]
const FRACTION_DENOMINATORS = [1, 2, 3, 4, 8]
const FINEST_DENOMINATOR = 8

type UnitNames = Pick<DisplayUnit, "name" | "pluralName" | "abbreviation" | "baseAmount">

function metricUnit(names: UnitNames): DisplayUnit {
  return { ...names, useAbbreviation: true, takeoverAt: 1, fraction: false }
}

function usUnit(names: UnitNames): DisplayUnit {
  return { ...names, useAbbreviation: true, takeoverAt: 1, fraction: true }
}

function standardOf(unit: IngredientUnit | null | undefined) {
  if (!unit?.standardUnit || !unit.standardQuantity) return null
  const standard = STANDARD_UNITS[unit.standardUnit]
  if (!standard) return null
  return {
    ...standard,
    baseAmount: standard.baseAmount * unit.standardQuantity,
    customary: standard.customary || !isPowerOfTen(unit.standardQuantity),
  }
}

function isPowerOfTen(value: number) {
  const exponent = Math.log10(value)
  return Math.abs(exponent - Math.round(exponent)) < 1e-9
}

function isSpoonMeasure({ dimension, customary, baseAmount }: StandardUnit) {
  return dimension === "volume" && customary && baseAmount <= LARGEST_SPOON_MEASURE_ML
}

function isWrittenIn(standard: StandardUnit, system: UnitSystem) {
  if (system === "us") return standard.customary
  return !standard.customary || isSpoonMeasure(standard)
}

function pickDisplayUnit(units: DisplayUnit[], baseAmount: number): DisplayUnit {
  let chosen = units[0]
  for (const unit of units) {
    if (baseAmount >= unit.baseAmount * unit.takeoverAt) chosen = unit
  }
  return chosen
}

function roundDecimal(value: number): number {
  const target = value * DECIMAL_TOLERANCE * 2
  const power = 10 ** Math.floor(Math.log10(target))
  let step = power
  for (const candidate of DECIMAL_STEPS) {
    if (target / power >= candidate) step = candidate * power
  }
  return Math.round(Math.round(value / step) * step * 1000) / 1000
}

function roundFraction(value: number): number | null {
  for (const denominator of FRACTION_DENOMINATORS) {
    const rounded = Math.round(value * denominator) / denominator
    if (rounded > 0 && Math.abs(rounded - value) <= value * FRACTION_TOLERANCE) return rounded
  }
  return null
}

function finestFraction(value: number): number {
  return Math.round(value * FINEST_DENOMINATOR) / FINEST_DENOMINATOR || value
}

function roundForDisplay(units: DisplayUnit[], baseAmount: number) {
  const unit = pickDisplayUnit(units, baseAmount)
  const value = baseAmount / unit.baseAmount

  if (!unit.fraction) return { unit, quantity: roundDecimal(value) }

  const rounded = roundFraction(value)
  if (rounded !== null) return { unit, quantity: rounded }

  const smaller = units[units.indexOf(unit) - 1]
  if (smaller && value < 1) {
    const smallerValue = baseAmount / smaller.baseAmount
    return { unit: smaller, quantity: roundFraction(smallerValue) ?? finestFraction(smallerValue) }
  }

  return { unit, quantity: finestFraction(value) }
}

function toIngredientUnit(unit: DisplayUnit): CreateIngredientUnit {
  return {
    name: unit.name,
    pluralName: unit.pluralName,
    abbreviation: unit.abbreviation,
    pluralAbbreviation: unit.pluralAbbreviation ?? unit.abbreviation,
    useAbbreviation: unit.useAbbreviation,
    fraction: unit.fraction,
  }
}

export function convertAmount(amount: Amount, preference: UnitPreference): Amount | null {
  if (preference === "as-written" || !amount.quantity) return null
  const standard = standardOf(amount.unit)
  if (!standard || isWrittenIn(standard, preference)) return null

  const { unit, quantity } = roundForDisplay(
    DISPLAY_UNITS[preference][standard.dimension],
    amount.quantity * standard.baseAmount
  )
  return { quantity, unit: toIngredientUnit(unit) }
}

export function isConvertible(amount: Amount): boolean {
  return UNIT_SYSTEMS.some(system => convertAmount(amount, system) !== null)
}

export function isUnitPreference(value: unknown): value is UnitPreference {
  return UNIT_PREFERENCES.includes(value as UnitPreference)
}

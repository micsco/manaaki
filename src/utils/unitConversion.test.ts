import { describe, expect, it } from "vitest"

import type { CreateIngredientUnit } from "../api/generated/types.gen"
import { convertAmount, isConvertible, isUnitPreference } from "./unitConversion"

function unit(name: string, standardQuantity: number, standardUnit: string): CreateIngredientUnit {
  return { name, standardQuantity, standardUnit }
}

const teaspoon = unit("teaspoon", 1 / 6, "fluid_ounce")
const tablespoon = unit("tablespoon", 1 / 2, "fluid_ounce")
const fluidOunce = unit("fluid ounce", 1, "fluid_ounce")
const cup = unit("cup", 1, "cup")
const pint = unit("pint", 2, "cup")
const ounce = unit("ounce", 1, "ounce")
const pound = unit("pound", 1, "pound")
const gram = unit("gram", 1, "gram")
const kilogram = unit("kilogram", 1, "kilogram")
const millilitre = unit("millilitre", 1, "milliliter")
const litre = unit("litre", 1, "liter")

function shown(quantity: number, from: CreateIngredientUnit, system: "metric" | "us") {
  const converted = convertAmount({ quantity, unit: from }, system)
  return converted && `${converted.quantity} ${converted.unit?.name}`
}

describe("convertAmount to metric", () => {
  it.each([
    [4, ounce, "115 gram"],
    [1, pound, "460 gram"],
    [3, pound, "1.35 kilogram"],
    [1, cup, "240 millilitre"],
    [1, pint, "480 millilitre"],
    [2, fluidOunce, "60 millilitre"],
    [5, cup, "1.2 litre"],
  ])("shows %s %s as %s", (quantity, from, expected) => {
    expect(shown(quantity, from, "metric")).toBe(expected)
  })

  it("leaves teaspoons and tablespoons as written", () => {
    expect(convertAmount({ quantity: 2, unit: teaspoon }, "metric")).toBeNull()
    expect(convertAmount({ quantity: 3, unit: tablespoon }, "metric")).toBeNull()
  })

  it("leaves amounts already in metric as written", () => {
    expect(convertAmount({ quantity: 250, unit: gram }, "metric")).toBeNull()
    expect(convertAmount({ quantity: 2, unit: litre }, "metric")).toBeNull()
  })

  it("marks metric units as decimals with abbreviations", () => {
    const converted = convertAmount({ quantity: 4, unit: ounce }, "metric")
    expect(converted?.unit).toMatchObject({
      abbreviation: "g",
      fraction: false,
      useAbbreviation: true,
    })
  })

  it("spells out litres", () => {
    const converted = convertAmount({ quantity: 5, unit: cup }, "metric")
    expect(converted?.unit).toMatchObject({ pluralName: "litres", useAbbreviation: false })
  })
})

describe("convertAmount to US", () => {
  it.each([
    [250, gram, "9 ounce"],
    [1, kilogram, "2.25 pound"],
    [500, millilitre, "2.125 cup"],
    [100, millilitre, "7 tablespoon"],
    [15, millilitre, "1 tablespoon"],
    [2, litre, "2.125 quart"],
  ])("shows %s %s as %s", (quantity, from, expected) => {
    expect(shown(quantity, from, "us")).toBe(expected)
  })

  it("leaves amounts already in US units as written", () => {
    expect(convertAmount({ quantity: 2, unit: cup }, "us")).toBeNull()
    expect(convertAmount({ quantity: 1, unit: teaspoon }, "us")).toBeNull()
  })

  it("marks US units as fractions", () => {
    expect(convertAmount({ quantity: 250, unit: gram }, "us")?.unit?.fraction).toBe(true)
  })
})

describe("convertAmount leaves an amount alone", () => {
  it("when showing as written", () => {
    expect(convertAmount({ quantity: 4, unit: ounce }, "as-written")).toBeNull()
  })

  it("without a quantity", () => {
    expect(convertAmount({ quantity: 0, unit: ounce }, "metric")).toBeNull()
    expect(convertAmount({ quantity: null, unit: ounce }, "metric")).toBeNull()
  })

  it("without a unit", () => {
    expect(convertAmount({ quantity: 2, unit: null }, "metric")).toBeNull()
  })

  it("when the unit has no standard measure", () => {
    expect(convertAmount({ quantity: 2, unit: { name: "handful" } }, "metric")).toBeNull()
  })

  it("when the standard measure is not one it knows", () => {
    expect(convertAmount({ quantity: 2, unit: unit("stone", 1, "stone") }, "metric")).toBeNull()
  })
})

describe("isConvertible", () => {
  it("is true for units that change in some system", () => {
    expect(isConvertible({ quantity: 1, unit: cup })).toBe(true)
    expect(isConvertible({ quantity: 100, unit: gram })).toBe(true)
  })

  it("is false for spoon measures, which every system keeps", () => {
    expect(isConvertible({ quantity: 1, unit: teaspoon })).toBe(false)
  })

  it("is false without a standard measure", () => {
    expect(isConvertible({ quantity: 1, unit: { name: "clove" } })).toBe(false)
  })
})

describe("isUnitPreference", () => {
  it("accepts the three choices", () => {
    expect(isUnitPreference("metric")).toBe(true)
    expect(isUnitPreference("us")).toBe(true)
    expect(isUnitPreference("as-written")).toBe(true)
  })

  it("rejects anything else", () => {
    expect(isUnitPreference("imperial")).toBe(false)
    expect(isUnitPreference(null)).toBe(false)
  })
})

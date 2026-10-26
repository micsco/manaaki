import type { CookingMethod } from "./recipeVersions"

export type HouseholdAppliance = {
  name: string
  model: string
  url: string
  details: string[]
  guidance: string[]
}

export const HOUSEHOLD_APPLIANCES: Partial<Record<CookingMethod, HouseholdAppliance>> = {
  airFryer: {
    name: "Ninja Foodi MAX Dual Zone Air Fryer",
    model: "AF400UK",
    url: "https://www.sharkninja.co.uk/ninja-foodi-max-dual-zone-air-fryer-af400uk/AF400UK.html",
    details: [
      "9.5 L in total, split across two independent non-stick drawers, each with a crisper plate",
      "Each drawer fits a 2 kg chicken; the whole unit feeds 8 or more",
      "Functions: Air Fry, Max Crisp, Roast, Bake, Reheat and Dehydrate, each with its own temperature setting",
      "SYNC finishes both drawers at the same time when they use different functions, temperatures or times; MATCH copies one drawer's settings to the other",
      "2,470 W",
    ],
    guidance: [
      "Spread food over both drawers in a single layer instead of cooking in batches",
      "When two parts of the dish need different settings, put them in separate drawers and use SYNC",
      "Name the function and temperature for each drawer, e.g. 'Zone 1: Air Fry at 200°C for 20 minutes'",
    ],
  },
  slowCooker: {
    name: "Ninja Foodi 8-in-1 PossibleCooker",
    model: "MC1001UK",
    url: "https://www.sharkninja.co.uk/ninja-foodi-8-in-1-possiblecooker-slow-cooker-multi-cooker-sea-salt-grey-mc1001uk/MC1001UK.html",
    details: [
      "8 L cooking pot with a glass lid, integrated spoon and steam rack; feeds up to 8",
      "Functions: Slow Cook (Low or Hi, up to 12 hours), Sear/Sauté, Steam, Braise (up to 12 hours), Simmer, Bake, Prove and Keep Warm (up to 12 hours)",
      "The pot is oven-safe up to 240°C",
      "1,200 W, heating from the base and sides",
    ],
    guidance: [
      "Brown meat and soften onions in the pot with Sear/Sauté instead of a separate pan",
      "Use the function names and Low or Hi, e.g. 'Slow Cook on Low for 7 hours'",
      "For a crisp or golden top, move the pot (without the lid) into the oven at up to 240°C",
    ],
  },
}

export function householdAppliance(method: CookingMethod): HouseholdAppliance | null {
  return HOUSEHOLD_APPLIANCES[method] ?? null
}

export function describeAppliance(appliance: HouseholdAppliance): string {
  return [
    `The household cooks with a ${appliance.name} (${appliance.model}):`,
    ...appliance.details.map(line => `- ${line}`),
    "Write the method for this appliance:",
    ...appliance.guidance.map(line => `- ${line}`),
  ].join("\n")
}

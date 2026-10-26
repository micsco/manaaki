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
      "9.5 L in total, split across two drawers: Zone 1 (left) and Zone 2 (right), each with its own heating element and fan, so raw and cooked foods can't cross-contaminate",
      "Each drawer has a removable crisper plate that lifts food so air flows underneath; each drawer fits a 2 kg chicken",
      "Air Fry: default 200°C, up to 1 hour",
      "Max Crisp: fixed at 240°C, up to 30 minutes; for smaller amounts of frozen food such as chips and nuggets",
      "Roast: default 190°C, up to 4 hours",
      "Bake: default 160°C, up to 4 hours",
      "Reheat: default 170°C, up to 1 hour",
      "Dehydrate: default 60°C, 1 to 12 hours, with food on the drawer base and on the crisper plate",
      "No preheating needed",
      "SYNC: both zones finish together with different functions, temperatures or times; the longer zone starts first and the other shows Hold until it starts",
      "MATCH: copies Zone 1's settings to Zone 2 for a larger batch",
      "Opening a drawer pauses that zone (and the other zone in SYNC or MATCH); temperature and time can be changed during cooking",
      "2,470 W",
    ],
    guidance: [
      "Don't add a preheating step",
      "Convert from a conventional oven by lowering the temperature by 10°C (Ninja's advice) and checking the food often, as it usually cooks faster",
      "Spread food over both drawers in a single, even layer instead of cooking in batches; if food overlaps, shake or turn it halfway",
      "Use the crisper plate for anything that should be crisp",
      "When two parts of the dish need different settings, put them in separate zones and use SYNC",
      "Name the zone, function, temperature and time, e.g. 'Zone 1: Air Fry at 200°C for 20 minutes'",
      "Use at least 1 tbsp of oil for fresh vegetables and potatoes",
      "Coat wet or battered food in flour, egg, then breadcrumbs pressed on firmly, and pin down light food such as a top slice of bread with cocktail sticks, so the fan doesn't blow it about",
      "Check meat and fish with a thermometer and remove food as soon as it's done",
    ],
  },
  slowCooker: {
    name: "Ninja Foodi 8-in-1 PossibleCooker",
    model: "MC1001UK",
    url: "https://www.sharkninja.co.uk/ninja-foodi-8-in-1-possiblecooker-slow-cooker-multi-cooker-sea-salt-grey-mc1001uk/MC1001UK.html",
    details: [
      "8 L non-stick cooking pot with a glass lid, spoon-ladle and steam rack; feeds up to 8; 1,200 W, heating from the base and sides",
      "Slow Cook: LO for 6 to 12 hours or HI for 3 to 12 hours, lid closed; switches to Keep Warm automatically",
      "Sear/Sauté: HI or LO, used like a hob with the lid off; heat for 5 minutes before adding food",
      "Braise: fixed at 99°C for 1 to 12 hours (default 6 hours), after searing and deglazing in the pot",
      "Simmer: fixed at 99°C, timer counts up",
      "Steam: on the rack over at least 250 ml of water or stock, 1 to 60 minutes",
      "Bake: 120 to 230°C with base and side heat only (no fan), up to 6 hours; best for puddings, upside-down cakes, cheesecakes and bain-marie dishes",
      "Prove: 30 to 40°C (default 35°C), up to 4 hours",
      "Keep Warm: up to 12 hours",
      "The pot can go in the oven (up to 240°C) but not on the hob",
    ],
    guidance: [
      "Brown meat and soften onions in the pot with Sear/Sauté (lid off) instead of a separate pan, then deglaze with about 125 ml of wine or stock, scraping up the browned bits",
      "Use the function names and settings, e.g. 'Slow Cook on LO for 7 hours' or 'Braise for 3 hours'",
      "Keep the lid on during Slow Cook and Braise; don't tell the cook to lift it to check",
      "Reduce added liquid compared with oven or hob recipes, because very little evaporates under the lid",
      "For a crisp or golden top, move the pot (without the glass lid) into the oven at up to 240°C; never put the pot on the hob",
      "Avoid adding fridge-cold ingredients to a very hot pot",
      "Check meat with a thermometer before serving",
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

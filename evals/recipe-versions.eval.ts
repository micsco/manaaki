import { existsSync } from "node:fs"
import process from "node:process"

import { describe, expect, it } from "vitest"

import { type DraftRequestRecipe, generateRecipeVersionDraft } from "../src/server/recipeVersionAi"
import { blockingChecks, checkDraft, type DraftSource } from "../src/utils/recipeVersionDraft"
import type { CookingMethod } from "../src/utils/recipeVersions"

if (existsSync(".env")) process.loadEnvFile(".env")

type Sample = { recipe: DraftRequestRecipe; target: CookingMethod; quantities: (number | null)[] }

const samples: Sample[] = [
  {
    target: "airFryer",
    quantities: [4, 2, 300, 4, null],
    recipe: {
      name: "BBQ Chicken Twice-Baked Potatoes",
      description: "Jacket potatoes stuffed with BBQ chicken and cheese.",
      servings: 4,
      method: "oven",
      ingredients: [
        "4 large baking potatoes",
        "2 tbsp olive oil",
        "300 g cooked chicken, shredded",
        "4 tbsp BBQ sauce",
        "salt and pepper",
      ],
      steps: [
        "Preheat the oven to 200°C (180°C fan). Rub the potatoes with oil and bake on a baking tray for 1 hour until soft.",
        "Halve the potatoes and scoop the flesh into a bowl. Mash with the chicken and BBQ sauce.",
        "Spoon the filling back into the skins and bake for 15 minutes until golden and piping hot.",
      ],
      notes: [],
      prepMinutes: 15,
      cookMinutes: 75,
      totalMinutes: 90,
      waitingNote: null,
    },
  },
  {
    target: "slowCooker",
    quantities: [800, 2, 3, 500, 2],
    recipe: {
      name: "Beef and Ale Stew",
      description: "",
      servings: 4,
      method: "oven",
      ingredients: [
        "800 g braising steak, diced",
        "2 onions, sliced",
        "3 carrots, chopped",
        "500 ml ale",
        "2 tbsp plain flour",
      ],
      steps: [
        "Preheat the oven to 160°C (140°C fan).",
        "Toss the beef in flour and brown in batches in a casserole dish.",
        "Add the onions and carrots, pour in the ale, cover and cook in the oven for 2½ hours until tender.",
      ],
      notes: [],
      prepMinutes: 20,
      cookMinutes: 160,
      totalMinutes: 180,
      waitingNote: null,
    },
  },
  {
    target: "oven",
    quantities: [1, 1, 2],
    recipe: {
      name: "Salt and Pepper Chicken Wings",
      description: "",
      servings: 2,
      method: "airFryer",
      ingredients: ["1 kg chicken wings", "1 tbsp baking powder", "2 tsp salt and pepper mix"],
      steps: [
        "Pat the wings dry and toss with the baking powder and seasoning.",
        "Air fry at 180°C for 25 minutes, shaking halfway, until crisp and cooked through.",
      ],
      notes: [],
      prepMinutes: 10,
      cookMinutes: 25,
      totalMinutes: 35,
      waitingNote: null,
    },
  },
]

const hasKey = Boolean(process.env.GEMINI_API_KEY)

describe.skipIf(!hasKey)("recipe version drafts (live Gemini)", () => {
  console.info(
    `Running ${samples.length} live drafts with ${process.env.GEMINI_MODEL || "gemini-3.8-flash"}. ` +
      "Each uses about 1–3k input and 1–2k output tokens; check current Gemini pricing."
  )
  let inputTokens = 0
  let outputTokens = 0

  it.each(samples)("$recipe.name → $target", async ({ recipe, target, quantities }) => {
    const { draft, usage } = await generateRecipeVersionDraft(recipe, target, "")
    inputTokens += usage.inputTokens
    outputTokens += usage.outputTokens
    const source: DraftSource = {
      name: recipe.name,
      method: recipe.method,
      ingredients: recipe.ingredients.map((text, index) => ({ text, quantity: quantities[index] })),
      steps: recipe.steps,
    }
    const checks = checkDraft(draft, source, target)
    console.table(checks.map(({ level, message }) => ({ level, message })))
    console.info(draft.steps.map((step, index) => `${index + 1}. ${step}`).join("\n"))
    console.info(`Tokens so far: ${inputTokens} in, ${outputTokens} out`)
    expect(blockingChecks(checks)).toEqual([])
  })
})

describe.skipIf(hasKey)("recipe version drafts", () => {
  it("needs GEMINI_API_KEY in .env or the environment", () => {
    console.info("Skipped: set GEMINI_API_KEY to run the live eval.")
  })
})

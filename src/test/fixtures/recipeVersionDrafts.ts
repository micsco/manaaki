import type { DraftSource, RecipeVersionDraft, StepTag } from "../../utils/recipeVersionDraft"

export const ovenSource: DraftSource = {
  name: "BBQ Chicken Twice-Baked Potatoes",
  method: "oven",
  ingredients: [
    { text: "4 large baking potatoes", quantity: 4 },
    { text: "2 tbsp olive oil", quantity: 2 },
    { text: "300 g cooked chicken, shredded", quantity: 300 },
    { text: "4 tbsp BBQ sauce", quantity: 4 },
    { text: "salt and pepper", quantity: null },
  ],
  steps: [
    "Preheat the oven to 200°C (180°C fan). Rub the potatoes with oil and bake on a baking tray for 1 hour until soft.",
    "Halve the potatoes and scoop the flesh into a bowl. Mash with the chicken and BBQ sauce.",
    "Spoon the filling back into the skins and bake for 15 minutes until golden and the chicken is piping hot and cooked through.",
  ],
}

export const goodAirFryerDraft: RecipeVersionDraft = {
  name: "BBQ Chicken Twice-Baked Potatoes (Air fryer)",
  description: "Crisp-skinned potatoes stuffed with BBQ chicken, made in the air fryer.",
  prepMinutes: 15,
  cookMinutes: 55,
  totalMinutes: 70,
  waitingNote: null,
  steps: [
    "Heat the air fryer to 190°C. Rub the potatoes with oil and air fry for 40–45 minutes, turning halfway, until soft.",
    "Halve the potatoes and scoop the flesh into a bowl. Mash with the chicken and BBQ sauce.",
    "Spoon the filling back into the skins and air fry at 180°C for 8–10 minutes until golden and the chicken is piping hot and cooked through.",
  ],
  notes: [
    { title: "Basket size", text: "Cook in two batches if the potatoes don't fit in one layer." },
  ],
  ingredientChanges: [
    { index: 1, quantity: 1, remove: false, reason: "Air fryers need less oil." },
  ],
  newIngredients: [],
  assumptions: ["A 5.5 L basket fits four potato halves at once."],
  confidence: "high",
}

export const goodAirFryerStepTags: StepTag[] = [
  {
    zone: "Zone 1",
    function: "Air Fry",
    setting: "190°C",
    minutes: 45,
    alongsidePrevious: false,
  },
  { zone: null, function: null, setting: null, minutes: null, alongsidePrevious: false },
  {
    zone: "Zone 1",
    function: "Air Fry",
    setting: "180°C",
    minutes: 10,
    alongsidePrevious: false,
  },
]

export function draftWith(patch: Partial<RecipeVersionDraft>): RecipeVersionDraft {
  return { ...goodAirFryerDraft, ...patch }
}

import { z } from "zod"

import type { RecipeVersionDraft } from "../utils/recipeVersionDraft"

export const draftSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000),
  prepMinutes: z.number().int().min(0).max(1440),
  cookMinutes: z.number().int().min(0).max(1440),
  totalMinutes: z.number().int().min(0).max(4320),
  waitingNote: z.string().max(200).nullable(),
  steps: z.array(z.string().min(1).max(2000)).min(1).max(40),
  notes: z
    .array(z.object({ title: z.string().max(120), text: z.string().min(1).max(3000) }))
    .max(10),
  ingredientChanges: z
    .array(
      z.object({
        index: z.number().int().min(0),
        quantity: z.number().positive().nullable(),
        remove: z.boolean(),
        reason: z.string().min(1).max(1000),
      })
    )
    .max(40),
  newIngredients: z
    .array(z.object({ text: z.string().min(1).max(300), reason: z.string().min(1).max(1000) }))
    .max(10),
  assumptions: z.array(z.string().min(1).max(1000)).max(10),
  confidence: z.enum(["high", "medium", "low"]),
}) satisfies z.ZodType<RecipeVersionDraft>

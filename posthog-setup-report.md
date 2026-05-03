<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into Manaaki. PostHog is now initialized via `PostHogProvider` in the root route, wrapping the entire app so all routes and components have access. A reverse proxy for EU PostHog ingestion was added to `vite.config.ts`. Environment variables are stored in `.env`. Ten custom events are now tracked across seven files, covering the full recipe browsing and cooking journey — from clicking a recipe card through to checking off ingredients and completing cooking steps.

| Event | Description | File |
|-------|-------------|------|
| `recipe_card_clicked` | User clicks a recipe card from the recipe list | `src/routes/recipes.index.tsx` |
| `recipe_viewed` | User navigates to a recipe detail page (top of cooking funnel) | `src/routes/recipes.$slug.tsx` |
| `recipe_navigated` (keyboard) | User presses arrow keys to navigate between recipes | `src/routes/recipes.$slug.tsx` |
| `cook_mode_entered` | User activates Cook Mode on a recipe | `src/components/CookModeToggle.tsx` |
| `cook_mode_exited` | User deactivates Cook Mode | `src/components/CookModeToggle.tsx` |
| `ingredient_checked` | User checks off an ingredient while cooking | `src/components/IngredientCheckbox.tsx` |
| `ingredient_unchecked` | User unchecks a previously checked ingredient | `src/components/IngredientCheckbox.tsx` |
| `recipe_step_completed` | User marks an instruction step as done | `src/components/InstructionStep.tsx` |
| `recipe_step_uncompleted` | User unmarks a previously completed instruction step | `src/components/InstructionStep.tsx` |
| `recipe_navigated` (click) | User clicks prev/next arrow buttons to navigate between recipes | `src/components/RecipeHeader.tsx` |
| `recipe_viewed_in_mealie` | User clicks "View in Mealie" to open the recipe in Mealie | `src/components/RecipeHeader.tsx` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- **Dashboard — Analytics basics**: https://eu.posthog.com/project/170060/dashboard/654335
- **Recipe Viewing Funnel** (recipe card clicked → recipe viewed → cook mode entered): https://eu.posthog.com/project/170060/insights/hZ01EW3y
- **Recipe Views Over Time** (daily trend): https://eu.posthog.com/project/170060/insights/7VTO4ZES
- **Cook Mode Engagement** (entered vs exited per day): https://eu.posthog.com/project/170060/insights/1eC8sxFv
- **Most Viewed Recipes** (top recipes by view count): https://eu.posthog.com/project/170060/insights/Fx0wRDXH
- **Recipe Engagement Depth** (steps completed, ingredients checked, Mealie opens): https://eu.posthog.com/project/170060/insights/b5iLSbSF

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/integration-tanstack-start/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>

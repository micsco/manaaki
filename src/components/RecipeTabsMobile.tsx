import { Tabs } from "@base-ui/react/tabs"

import type {
  RecipeCategory,
  RecipeIngredientOutput,
  RecipeStep,
  RecipeTag,
} from "../api/generated/types.gen"
import { IngredientsSection } from "./IngredientsSection"
import { InstructionsSection } from "./InstructionsSection"
import { Badge } from "./ui"

type Tab = "ingredients" | "method" | "description"

const TAB_LABELS: Record<Tab, string> = {
  ingredients: "Ingredients",
  method: "Method",
  description: "Description",
}

export function RecipeTabsMobile({
  ingredients,
  instructions,
  description,
  categories,
  tags,
  recipeId,
  defaultServings,
  img,
}: {
  ingredients: RecipeIngredientOutput[]
  instructions: RecipeStep[]
  description?: string | null
  categories?: RecipeCategory[] | null
  tags?: RecipeTag[] | null
  recipeId: string
  defaultServings?: number | null
  img?: string | null
}) {
  const hasDescription = !!(description || categories?.length || tags?.length)
  const availableTabs: Tab[] = [
    "ingredients",
    "method",
    ...(hasDescription ? (["description"] as Tab[]) : []),
  ]

  return (
    <Tabs.Root defaultValue="ingredients" className="md:hidden">
      <Tabs.List aria-label="Recipe sections" className="flex border-b border-gray-800">
        {availableTabs.map(tab => (
          <Tabs.Tab
            key={tab}
            value={tab}
            className="min-h-11 flex-1 border-b-2 border-transparent py-3 font-sans text-sm font-medium text-gray-400 transition-colors hover:text-gray-200 focus-visible:outline-2 focus-visible:outline-orange-400 data-active:border-orange-500 data-active:text-white"
          >
            {TAB_LABELS[tab]}
          </Tabs.Tab>
        ))}
      </Tabs.List>

      <Tabs.Panel value="ingredients" className="px-6 py-6">
        <IngredientsSection
          ingredients={ingredients}
          recipeId={recipeId}
          defaultServings={defaultServings}
          steps={instructions}
        />
      </Tabs.Panel>

      <Tabs.Panel value="method" className="px-6 py-6">
        <InstructionsSection steps={instructions} recipeId={recipeId} img={img} />
      </Tabs.Panel>

      {hasDescription && (
        <Tabs.Panel value="description" className="px-6 py-6">
          {description && <p className="text-base leading-relaxed text-gray-300">{description}</p>}
          {categories?.length || tags?.length ? (
            <div className={`flex flex-wrap gap-2 ${description ? "mt-4" : ""}`}>
              {categories?.map(c => (
                <Badge key={c.id ?? c.slug ?? c.name} variant="category">
                  {c.name}
                </Badge>
              ))}
              {tags?.map(t => (
                <Badge key={t.id ?? t.slug ?? t.name} variant="tag">
                  {t.name}
                </Badge>
              ))}
            </div>
          ) : null}
        </Tabs.Panel>
      )}
    </Tabs.Root>
  )
}

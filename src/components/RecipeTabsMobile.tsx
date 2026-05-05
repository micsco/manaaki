import { useState } from "react"
import type { RecipeIngredientOutput, RecipeStep } from "../api/generated/types.gen"
import { IngredientsSection } from "./IngredientsSection"
import { InstructionsSection } from "./InstructionsSection"

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
  recipeId,
  defaultServings,
  img,
}: {
  ingredients: RecipeIngredientOutput[]
  instructions: RecipeStep[]
  description?: string | null
  recipeId: string
  defaultServings?: number | null
  img?: string | null
}) {
  const hasDescription = !!description
  const availableTabs: Tab[] = [
    "ingredients",
    "method",
    ...(hasDescription ? (["description"] as Tab[]) : []),
  ]

  const [activeTab, setActiveTab] = useState<Tab>("ingredients")

  return (
    <div className="md:hidden">
      <div role="tablist" aria-label="Recipe sections" className="flex border-gray-800 border-b">
        {availableTabs.map(tab => (
          <button
            key={tab}
            role="tab"
            type="button"
            aria-selected={activeTab === tab}
            aria-controls={`tab-panel-${tab}`}
            id={`tab-${tab}`}
            onClick={() => setActiveTab(tab)}
            className={[
              "flex-1 pt-2 pb-3 font-medium font-sans text-sm transition-colors",
              activeTab === tab
                ? "border-orange-500 border-b-2 text-white"
                : "text-gray-400 hover:text-gray-200",
            ].join(" ")}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      <div
        id="tab-panel-ingredients"
        role="tabpanel"
        aria-labelledby="tab-ingredients"
        hidden={activeTab !== "ingredients"}
        className="px-6 py-6"
      >
        <IngredientsSection
          ingredients={ingredients}
          recipeId={recipeId}
          defaultServings={defaultServings}
        />
      </div>

      <div
        id="tab-panel-method"
        role="tabpanel"
        aria-labelledby="tab-method"
        hidden={activeTab !== "method"}
        className="px-6 py-6"
      >
        <InstructionsSection steps={instructions} recipeId={recipeId} img={img} />
      </div>

      {hasDescription && (
        <div
          id="tab-panel-description"
          role="tabpanel"
          aria-labelledby="tab-description"
          hidden={activeTab !== "description"}
          className="px-6 py-6"
        >
          <p className="text-base text-gray-300 leading-relaxed">{description}</p>
        </div>
      )}
    </div>
  )
}

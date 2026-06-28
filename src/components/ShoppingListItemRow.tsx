import { mdiCheck, mdiChevronDown, mdiClose } from "@mdi/js"
import { useState } from "react"
import type { ShoppingListItemOutOutput } from "../api/generated"
import { useRecipeNameMap } from "../hooks/useRecipeNameMap"
import { recipeUrl } from "../utils/recipe"
import { Icon } from "./Icon"

export function ShoppingListItemRow({
  item,
  onToggle,
  onDelete,
  disabled,
}: {
  item: ShoppingListItemOutOutput
  onToggle: () => void
  onDelete: () => void
  disabled?: boolean
}) {
  const checked = item.checked ?? false
  const label = item.display ?? item.note ?? "Item"
  const names = useRecipeNameMap()
  const recipeIds = [...new Set((item.recipeReferences ?? []).map(r => r.recipeId))]
  const [expanded, setExpanded] = useState(false)

  return (
    <li className="group border-gray-800 border-t last:border-b">
      <div className="flex items-center">
        <button
          type="button"
          disabled={disabled}
          onClick={onToggle}
          aria-label={`${label}${checked ? ", checked" : ""}`}
          className="flex min-h-12 flex-1 cursor-pointer items-center gap-3 py-3 text-left transition-colors hover:text-gray-200 disabled:opacity-60"
        >
          <span
            className={`flex size-6 shrink-0 items-center justify-center rounded-full border ${
              checked
                ? "border-green-600 bg-green-600/20 text-green-500"
                : "border-gray-600 text-transparent"
            }`}
          >
            <Icon path={mdiCheck} size={0.6} aria-hidden={true} />
          </span>
          <span
            className={`min-w-0 flex-1 ${checked ? "text-gray-500 line-through opacity-75" : "text-gray-200"}`}
          >
            {label}
          </span>
        </button>
        {recipeIds.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            aria-label="Show recipes"
            aria-expanded={expanded}
            className="flex size-10 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:text-gray-300"
          >
            <Icon
              path={mdiChevronDown}
              size={0.7}
              aria-hidden={true}
              className={`transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          </button>
        )}
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Remove ${label}`}
          className="flex size-10 shrink-0 items-center justify-center rounded-full text-gray-600 transition-colors hover:text-gray-300"
        >
          <Icon path={mdiClose} size={0.7} aria-hidden={true} />
        </button>
      </div>
      {expanded && recipeIds.length > 0 && (
        <ul className="pb-2 pl-9 text-gray-400 text-xs">
          {recipeIds.map(id => {
            const r = names.get(id)
            return (
              <li key={id}>
                {r?.slug ? (
                  <a href={recipeUrl(id, r.slug)} className="text-orange-400 hover:text-orange-300">
                    {r.name}
                  </a>
                ) : (
                  (r?.name ?? "Recipe")
                )}
              </li>
            )
          })}
        </ul>
      )}
    </li>
  )
}

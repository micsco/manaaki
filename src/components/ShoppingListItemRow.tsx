import { mdiCheck, mdiClose } from "@mdi/js"
import type { ShoppingListItemOutOutput } from "../api/generated"
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
  return (
    <li className="group flex items-center border-gray-800 border-t last:border-b">
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
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Remove ${label}`}
        className="ml-2 hidden size-10 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:text-gray-300 group-hover:flex"
      >
        <Icon path={mdiClose} size={0.7} aria-hidden={true} />
      </button>
    </li>
  )
}

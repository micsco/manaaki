import { UtensilsCrossed } from "lucide-react"
import { useCookMode } from "../contexts/CookModeContext"

export function CookModeToggle() {
  const { isCookMode, toggleCookMode } = useCookMode()

  return (
    <button
      type="button"
      onClick={toggleCookMode}
      className={`inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full px-4 py-2 font-medium text-sm transition-colors ${
        isCookMode
          ? "bg-orange-600 text-white hover:bg-orange-500 active:bg-orange-700"
          : "bg-gray-800 text-gray-300 hover:bg-gray-700 active:bg-gray-600"
      }`}
    >
      <UtensilsCrossed className="h-4 w-4 shrink-0" aria-hidden="true" />
      {isCookMode ? "Exit Cook Mode" : "Cook Mode"}
    </button>
  )
}

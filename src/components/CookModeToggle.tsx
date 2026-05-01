import { mdiChefHat } from "@mdi/js"
import { usePostHog } from "@posthog/react"
import { useCookMode } from "../contexts/CookModeContext"
import { Icon } from "./Icon"

export function CookModeToggle() {
  const { isCookMode, toggleCookMode } = useCookMode()
  const posthog = usePostHog()

  const handleToggle = () => {
    posthog.capture(isCookMode ? "cook_mode_exited" : "cook_mode_entered")
    toggleCookMode()
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={`inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full px-4 py-2 font-medium text-sm transition-colors ${
        isCookMode
          ? "bg-orange-600 text-white hover:bg-orange-500 active:bg-orange-700"
          : "bg-gray-800 text-gray-300 hover:bg-gray-700 active:bg-gray-600"
      }`}
    >
      <Icon path={mdiChefHat} size={0.75} aria-hidden={true} />
      {isCookMode ? "Exit Cook Mode" : "Cook Mode"}
    </button>
  )
}

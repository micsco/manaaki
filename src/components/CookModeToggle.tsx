import { Switch as BaseSwitch } from "@base-ui/react/switch"
import { useCookMode } from "../contexts/CookModeContext"

export function CookModeToggle() {
  const { isCookMode, toggleCookMode } = useCookMode()

  return (
    <div className="flex items-center gap-3">
      <BaseSwitch.Root
        checked={isCookMode}
        onCheckedChange={toggleCookMode}
        className="group relative inline-flex h-6 w-11 items-center rounded-full bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-gray-950 data-[checked]:bg-orange-600"
      >
        <BaseSwitch.Thumb className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform group-data-[checked]:translate-x-6 translate-x-1" />
      </BaseSwitch.Root>
      <span className="text-sm font-medium text-gray-300">Cook Mode</span>
      {isCookMode && (
        <span className="text-xs text-orange-400 animate-pulse">(Ctrl+K to exit)</span>
      )}
    </div>
  )
}

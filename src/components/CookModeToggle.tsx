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
        <BaseSwitch.Thumb className="inline-block h-4 w-4 translate-x-1 transform rounded-full bg-white transition-transform group-data-[checked]:translate-x-6" />
      </BaseSwitch.Root>
      <span className="font-medium text-gray-300 text-sm">Cook Mode</span>
      {isCookMode && (
        <span className="animate-pulse text-orange-400 text-xs">(Ctrl+K to exit)</span>
      )}
    </div>
  )
}

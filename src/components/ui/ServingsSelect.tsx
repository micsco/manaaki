import { Select } from "@base-ui/react/select"
import { mdiCheck, mdiChevronDown } from "@mdi/js"
import { Icon } from "../Icon"

interface ServingsSelectProps {
  value: number
  onChange: (value: number | null) => void
}

const SERVINGS_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

export function ServingsSelect({ value, onChange }: ServingsSelectProps) {
  return (
    <Select.Root value={value} onValueChange={onChange}>
      <Select.Trigger
        aria-label={`Servings: ${value}. Tap to change`}
        className={[
          "flex items-center gap-1.5 rounded-full border border-gray-700 bg-gray-800",
          "px-3 py-1.5 text-gray-300 text-sm transition-colors",
          "hover:border-gray-600 hover:bg-gray-700 hover:text-gray-100",
          "focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-gray-950",
          "data-[popup-open]:border-orange-500 data-[popup-open]:text-gray-100",
        ].join(" ")}
      >
        <span className="text-gray-500 text-xs uppercase tracking-widest">Servings</span>
        <span className="font-semibold text-gray-100">
          <Select.Value />
        </span>
        <Icon path={mdiChevronDown} size={0.55} aria-hidden className="text-gray-400" />
      </Select.Trigger>

      <Select.Portal>
        <Select.Positioner sideOffset={8}>
          <Select.Popup
            className={[
              "rounded-xl border border-gray-700 bg-gray-900 py-1 shadow-black/40 shadow-xl",
              "origin-[var(--transform-origin)] transition-[transform,scale,opacity]",
              "data-[ending-style]:scale-95 data-[ending-style]:opacity-0",
              "data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
              "focus:outline-none",
            ].join(" ")}
          >
            <Select.List>
              {SERVINGS_OPTIONS.map(n => (
                <Select.Item
                  key={n}
                  value={n}
                  className={[
                    "flex cursor-pointer items-center gap-2 px-4 py-2 text-sm transition-colors",
                    "text-gray-300 hover:bg-gray-800 hover:text-gray-100",
                    "data-[selected]:font-semibold data-[selected]:text-orange-400",
                    "data-[highlighted]:bg-gray-800 data-[highlighted]:text-gray-100",
                    "focus:outline-none",
                  ].join(" ")}
                >
                  <Select.ItemIndicator className="w-3 text-orange-500">
                    <Icon path={mdiCheck} size={0.5} aria-hidden />
                  </Select.ItemIndicator>
                  <Select.ItemText>{n}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  )
}

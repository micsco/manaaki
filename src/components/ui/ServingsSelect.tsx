import { Select } from "@base-ui/react/select"
import { mdiCheck, mdiChevronDown } from "@mdi/js"

import { Icon } from "../Icon"
import { SELECT_ITEM_CLASS, SELECT_POPUP_CLASS, SELECT_TRIGGER_CLASS } from "./selectStyles"

interface ServingsSelectProps {
  value: number
  onChange: (value: number | null) => void
  defaultServings: number
}

const SERVINGS_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

export function ServingsSelect({ value, onChange, defaultServings }: ServingsSelectProps) {
  return (
    <Select.Root value={value} onValueChange={onChange}>
      <Select.Trigger
        aria-label={`Servings: ${value}. Tap to change`}
        className={SELECT_TRIGGER_CLASS}
      >
        <span className="text-xs tracking-widest text-gray-500 uppercase">Servings</span>
        <span className="font-semibold text-gray-100 tabular-nums">
          <Select.Value />
        </span>
        <Icon path={mdiChevronDown} size={0.55} aria-hidden />
      </Select.Trigger>

      <Select.Portal>
        <Select.Positioner align="end" sideOffset={8}>
          <Select.Popup className={SELECT_POPUP_CLASS}>
            <Select.List>
              {SERVINGS_OPTIONS.map(n => (
                <Select.Item key={n} value={n} className={SELECT_ITEM_CLASS}>
                  <Select.ItemIndicator className="w-3 shrink-0 text-orange-500">
                    <Icon path={mdiCheck} size={0.5} aria-hidden />
                  </Select.ItemIndicator>
                  <span className="flex flex-1 items-baseline justify-end gap-2">
                    {n === defaultServings && (
                      <span className="text-xs text-gray-600">original</span>
                    )}
                    <Select.ItemText>
                      <span className="tabular-nums">{n}</span>
                    </Select.ItemText>
                  </span>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  )
}

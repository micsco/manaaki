import { Select } from "@base-ui/react/select"
import { mdiCheck, mdiChevronDown } from "@mdi/js"

import { UNIT_PREFERENCES, type UnitPreference } from "../../utils/unitConversion"
import { Icon } from "../Icon"
import { SELECT_ITEM_CLASS, SELECT_POPUP_CLASS, SELECT_TRIGGER_CLASS } from "./selectStyles"

const UNIT_PREFERENCE_LABELS: Record<UnitPreference, { name: string; hint?: string }> = {
  metric: { name: "Metric", hint: "g, ml" },
  us: { name: "US", hint: "cups, oz" },
  "as-written": { name: "As written" },
}

interface UnitSystemSelectProps {
  value: UnitPreference
  onChange: (value: UnitPreference) => void
}

export function UnitSystemSelect({ value, onChange }: UnitSystemSelectProps) {
  const label = UNIT_PREFERENCE_LABELS[value].name
  return (
    <Select.Root
      value={value}
      onValueChange={next => {
        if (next != null) onChange(next)
      }}
    >
      <Select.Trigger
        aria-label={`Units: ${label}. Tap to change`}
        className={SELECT_TRIGGER_CLASS}
      >
        <span className="text-xs tracking-widest text-gray-500 uppercase">{label}</span>
        <Icon path={mdiChevronDown} size={0.55} aria-hidden />
      </Select.Trigger>

      <Select.Portal>
        <Select.Positioner align="end" sideOffset={8}>
          <Select.Popup className={SELECT_POPUP_CLASS}>
            <Select.List>
              {UNIT_PREFERENCES.map(preference => {
                const { name, hint } = UNIT_PREFERENCE_LABELS[preference]
                return (
                  <Select.Item key={preference} value={preference} className={SELECT_ITEM_CLASS}>
                    <Select.ItemIndicator className="w-3 shrink-0 text-orange-500">
                      <Icon path={mdiCheck} size={0.5} aria-hidden />
                    </Select.ItemIndicator>
                    <span className="flex flex-1 items-baseline justify-between gap-3">
                      <Select.ItemText>{name}</Select.ItemText>
                      {hint && <span className="text-xs text-gray-600">{hint}</span>}
                    </span>
                  </Select.Item>
                )
              })}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  )
}

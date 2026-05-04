import { Drawer } from "@base-ui/react/drawer"
import { mdiClose } from "@mdi/js"
import type { ReactNode } from "react"
import {
  PROTEIN_OPTIONS,
  TIME_BUCKETS,
  type TimeBucket,
  TOOL_OPTIONS,
} from "../hooks/useRecipeFilters"
import { Icon } from "./Icon"
import { Button } from "./ui"

interface SectionProps {
  label: string
  children: ReactNode
}

function FilterSection({ label, children }: SectionProps) {
  return (
    <div>
      <h3 className="mb-3 font-semibold text-gray-200 text-sm uppercase tracking-wider">{label}</h3>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

interface ToggleChipProps {
  icon: string
  label: string
  active: boolean
  onToggle: () => void
}

function ToggleChip({ icon, label, active, onToggle }: ToggleChipProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className={[
        "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2.5 font-medium text-sm transition-colors",
        "focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-gray-900",
        active
          ? "border-orange-500 bg-orange-900 text-orange-300"
          : "border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-600 hover:bg-gray-700",
      ].join(" ")}
    >
      <Icon path={icon} size={0.6} aria-hidden={true} />
      {label}
    </button>
  )
}

interface RecipeFilterDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  proteins: string[]
  onToggleProtein: (value: string) => void
  tools: string[]
  onToggleTool: (value: string) => void
  time: TimeBucket | null
  onSetTime: (value: TimeBucket | null) => void
  activeFilterCount: number
  onClearAll: () => void
}

export function RecipeFilterDrawer({
  open,
  onOpenChange,
  proteins,
  onToggleProtein,
  tools,
  onToggleTool,
  time,
  onSetTime,
  activeFilterCount,
  onClearAll,
}: RecipeFilterDrawerProps) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Backdrop className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
        <Drawer.Popup
          className={[
            "fixed right-0 bottom-0 left-0 z-50 flex max-h-[85dvh] flex-col",
            "rounded-t-2xl border-gray-700 border-t bg-gray-900",
            "focus:outline-none",
          ].join(" ")}
        >
          <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-gray-600" aria-hidden="true" />

          <div className="flex items-center justify-between px-5 py-4">
            <Drawer.Title className="font-semibold text-gray-100 text-lg">
              Filter recipes
            </Drawer.Title>
            <Drawer.Close
              className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-800 hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
              aria-label="Close filters"
            >
              <Icon path={mdiClose} size={0.7} aria-hidden={true} />
            </Drawer.Close>
          </div>

          <div className="flex-1 space-y-6 overflow-y-auto px-5 pb-4">
            <FilterSection label="Total time">
              {TIME_BUCKETS.map(bucket => (
                <ToggleChip
                  key={bucket.value}
                  icon={bucket.icon}
                  label={bucket.label}
                  active={time === bucket.value}
                  onToggle={() => onSetTime(time === bucket.value ? null : bucket.value)}
                />
              ))}
            </FilterSection>

            <FilterSection label="Protein">
              {PROTEIN_OPTIONS.map(opt => (
                <ToggleChip
                  key={opt.value}
                  icon={opt.icon}
                  label={opt.label}
                  active={proteins.includes(opt.value)}
                  onToggle={() => onToggleProtein(opt.value)}
                />
              ))}
            </FilterSection>

            <FilterSection label="Equipment">
              {TOOL_OPTIONS.map(opt => (
                <ToggleChip
                  key={opt.value}
                  icon={opt.icon}
                  label={opt.label}
                  active={tools.includes(opt.value)}
                  onToggle={() => onToggleTool(opt.value)}
                />
              ))}
            </FilterSection>
          </div>

          <div className="flex gap-3 border-gray-800 border-t px-5 py-4">
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="lg"
                onClick={() => {
                  onClearAll()
                  onOpenChange(false)
                }}
              >
                Clear all
              </Button>
            )}
            <Button
              variant="primary"
              size="lg"
              onClick={() => onOpenChange(false)}
              className="flex-1 whitespace-nowrap"
            >
              {activeFilterCount > 0
                ? `Show results (${activeFilterCount} filter${activeFilterCount === 1 ? "" : "s"})`
                : "Show results"}
            </Button>
          </div>
        </Drawer.Popup>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

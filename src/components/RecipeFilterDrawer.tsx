import { Drawer } from "@base-ui/react/drawer"
import { mdiClose } from "@mdi/js"
import { usePostHog } from "@posthog/react"
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
  value: string
  type: "protein" | "tool"
  active: boolean
  onToggle: () => void
}

function ToggleChip({ icon, label, value, type, active, onToggle }: ToggleChipProps) {
  const posthog = usePostHog()

  const handleClick = () => {
    posthog.capture("filter_toggled", {
      filter_type: type,
      filter_value: value,
      filter_label: label,
      action: active ? "removed" : "added",
      source: "drawer",
    })
    onToggle()
  }

  return (
    <button
      type="button"
      onClick={handleClick}
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

interface TimeBucketSegmentWithTrackingProps {
  value: TimeBucket | null
  onChange: (value: TimeBucket | null) => void
}

function TimeBucketOptionWithTracking({
  bucket,
  active,
  hasBorderLeft,
  onChange,
}: {
  bucket: (typeof TIME_BUCKETS)[number]
  active: boolean
  hasBorderLeft: boolean
  onChange: (value: TimeBucket | null) => void
}) {
  const posthog = usePostHog()

  const handleClick = () => {
    const newValue = active ? null : bucket.value
    posthog.capture("time_filter_changed", {
      time_bucket: newValue,
      time_bucket_label: bucket.label,
      action: active ? "removed" : "added",
      source: "drawer",
    })
    onChange(newValue)
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: segmented control with deselect needs button+role="radio", not <input type="radio">
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={handleClick}
      className={[
        "flex flex-1 items-center justify-center py-2.5 font-medium text-sm transition-colors",
        "focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-inset",
        hasBorderLeft ? "border-gray-700 border-l" : "",
        active ? "bg-orange-600 text-white" : "text-gray-300 hover:bg-gray-700 hover:text-gray-100",
      ].join(" ")}
    >
      {bucket.label}
    </button>
  )
}

function TimeBucketSegmentWithTracking({ value, onChange }: TimeBucketSegmentWithTrackingProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Total time"
      className="flex w-full overflow-hidden rounded-lg border border-gray-700 bg-gray-800"
    >
      {TIME_BUCKETS.map((bucket, i) => (
        <TimeBucketOptionWithTracking
          key={bucket.value}
          bucket={bucket}
          active={value === bucket.value}
          hasBorderLeft={i > 0}
          onChange={onChange}
        />
      ))}
    </div>
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
  const posthog = usePostHog()

  const handleClearAll = () => {
    posthog.capture("all_filters_cleared", {
      previous_filter_count: activeFilterCount,
      previous_proteins: proteins,
      previous_tools: tools,
      previous_time: time,
    })
    onClearAll()
    onOpenChange(false)
  }

  return (
    <Drawer.Root
      open={open}
      onOpenChange={isOpen => {
        if (!isOpen && open) {
          posthog.capture("filter_drawer_closed", {
            active_filter_count: activeFilterCount,
          })
        }
        onOpenChange(isOpen)
      }}
    >
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
            <FilterSection label="Equipment">
              {TOOL_OPTIONS.map(opt => (
                <ToggleChip
                  key={opt.value}
                  icon={opt.icon}
                  label={opt.label}
                  value={opt.value}
                  type="tool"
                  active={tools.includes(opt.value)}
                  onToggle={() => onToggleTool(opt.value)}
                />
              ))}
            </FilterSection>

            <FilterSection label="Protein">
              {PROTEIN_OPTIONS.map(opt => (
                <ToggleChip
                  key={opt.value}
                  icon={opt.icon}
                  label={opt.label}
                  value={opt.value}
                  type="protein"
                  active={proteins.includes(opt.value)}
                  onToggle={() => onToggleProtein(opt.value)}
                />
              ))}
            </FilterSection>

            <FilterSection label="Total time">
              <TimeBucketSegmentWithTracking value={time} onChange={onSetTime} />
            </FilterSection>
          </div>

          <div className="flex gap-3 border-gray-800 border-t px-5 py-4">
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="lg" onClick={handleClearAll}>
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

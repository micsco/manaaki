import { Drawer } from "@base-ui/react/drawer"
import { mdiClose } from "@mdi/js"
import type { ReactNode } from "react"

import { usePostHog } from "../contexts/AnalyticsContext"
import {
  HANDS_ON_BUCKETS,
  type HandsOnBucket,
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
      <h3 className="mb-3 text-sm font-semibold tracking-wider text-gray-200 uppercase">{label}</h3>
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
        "focus:outline-hidden focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-gray-900",
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

interface BucketSegmentProps<T extends string> {
  label: string
  event: "time_filter_changed" | "hands_on_filter_changed"
  buckets: { value: T; label: string }[]
  value: T | null
  onChange: (value: T | null) => void
}

function BucketSegment<T extends string>({
  label,
  event,
  buckets,
  value,
  onChange,
}: BucketSegmentProps<T>) {
  const posthog = usePostHog()

  function choose(bucket: { value: T; label: string }) {
    const active = value === bucket.value
    const newValue = active ? null : bucket.value
    posthog.capture(event, {
      time_bucket: newValue,
      time_bucket_label: bucket.label,
      action: active ? "removed" : "added",
      source: "drawer",
    })
    onChange(newValue)
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex w-full overflow-hidden rounded-lg border border-gray-700 bg-gray-800"
    >
      {buckets.map((bucket, i) => {
        const active = value === bucket.value
        return (
          <button
            key={bucket.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => choose(bucket)}
            className={[
              "flex flex-1 items-center justify-center py-2.5 font-medium text-sm transition-colors",
              "focus:outline-hidden focus:ring-2 focus:ring-orange-500 focus:ring-inset",
              i > 0 ? "border-gray-700 border-l" : "",
              active
                ? "bg-orange-600 text-white"
                : "text-gray-300 hover:bg-gray-700 hover:text-gray-100",
            ].join(" ")}
          >
            {bucket.label}
          </button>
        )
      })}
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
  handsOn: HandsOnBucket | null
  onSetHandsOn: (value: HandsOnBucket | null) => void
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
  handsOn,
  onSetHandsOn,
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
      previous_hands_on: handsOn,
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
        <Drawer.Backdrop className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs" />
        <Drawer.Popup
          className={[
            "pb-[env(safe-area-inset-bottom,0px)] fixed right-0 bottom-0 left-0 z-50 flex max-h-[85dvh] flex-col",
            "rounded-t-2xl border-gray-700 border-t bg-gray-900",
            "focus:outline-hidden",
          ].join(" ")}
        >
          <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-gray-600" aria-hidden="true" />

          <div className="flex items-center justify-between px-5 py-4">
            <Drawer.Title className="text-lg font-semibold text-gray-100">
              Filter recipes
            </Drawer.Title>
            <Drawer.Close
              className="flex h-11 w-11 items-center justify-center rounded-full text-gray-400 hover:bg-gray-800 hover:text-gray-200 focus:ring-2 focus:ring-orange-500 focus:outline-hidden"
              aria-label="Close filters"
            >
              <Icon path={mdiClose} size={0.7} aria-hidden={true} />
            </Drawer.Close>
          </div>

          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-5 pb-4">
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

            <FilterSection label="Ready in">
              <BucketSegment
                label="Ready in"
                event="time_filter_changed"
                buckets={TIME_BUCKETS}
                value={time}
                onChange={onSetTime}
              />
            </FilterSection>

            <FilterSection label="Hands-on">
              <p className="w-full text-sm text-gray-400">
                Prep time: chopping and putting it together before it cooks. Doesn’t count time at
                the hob.
              </p>
              <BucketSegment
                label="Hands-on"
                event="hands_on_filter_changed"
                buckets={HANDS_ON_BUCKETS}
                value={handsOn}
                onChange={onSetHandsOn}
              />
            </FilterSection>
          </div>

          <div className="flex gap-3 border-t border-gray-800 px-5 py-4">
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

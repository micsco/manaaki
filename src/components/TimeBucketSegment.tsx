import { TIME_BUCKETS, type TimeBucket } from "../hooks/useRecipeFilters"

interface TimeBucketSegmentProps {
  value: TimeBucket | null
  onChange: (value: TimeBucket | null) => void
}

function TimeBucketOption({
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
  return (
    // biome-ignore lint/a11y/useSemanticElements: segmented control with deselect needs button+role="radio", not <input type="radio">
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={() => onChange(active ? null : bucket.value)}
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

export function TimeBucketSegment({ value, onChange }: TimeBucketSegmentProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Total time"
      className="flex w-full overflow-hidden rounded-lg border border-gray-700 bg-gray-800"
    >
      {TIME_BUCKETS.map((bucket, i) => (
        <TimeBucketOption
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

import { mdiClose, mdiMagnify, mdiTune } from "@mdi/js"
import { PROTEIN_OPTIONS, type TimeBucket, TOOL_OPTIONS } from "../hooks/useRecipeFilters"
import { Icon } from "./Icon"
import { Button } from "./ui"

interface FilterChipProps {
  icon: string
  label: string
  active: boolean
  onToggle: () => void
}

function FilterChip({ icon, label, active, onToggle }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={[
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 font-medium text-sm transition-colors",
        "focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-gray-950",
        active
          ? "border-orange-500 bg-orange-600/20 text-orange-300"
          : "border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-600 hover:bg-gray-700",
      ].join(" ")}
      aria-pressed={active}
    >
      <Icon path={icon} size={0.6} aria-hidden={true} />
      {label}
    </button>
  )
}

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
        <Icon path={mdiMagnify} size={0.75} aria-hidden={true} className="text-gray-400" />
      </div>
      <input
        type="search"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Search recipes…"
        className={[
          "w-full rounded-xl border border-gray-700 bg-gray-800 py-3 pr-4 pl-11 text-gray-100 text-sm",
          "placeholder:text-gray-500",
          "focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30",
          "transition-colors",
        ].join(" ")}
        aria-label="Search recipes"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute inset-y-0 right-0 flex items-center pr-4 text-gray-400 hover:text-gray-200"
          aria-label="Clear search"
        >
          <Icon path={mdiClose} size={0.6} aria-hidden={true} />
        </button>
      )}
    </div>
  )
}

interface FilterPillsProps {
  proteins: string[]
  onToggleProtein: (value: string) => void
  tools: string[]
  onToggleTool: (value: string) => void
}

export function FilterPills({ proteins, onToggleProtein, tools, onToggleTool }: FilterPillsProps) {
  return (
    <div className="-mx-4 flex gap-2.5 overflow-x-auto px-4 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {PROTEIN_OPTIONS.map(opt => (
        <FilterChip
          key={opt.value}
          icon={opt.icon}
          label={opt.label}
          active={proteins.includes(opt.value)}
          onToggle={() => onToggleProtein(opt.value)}
        />
      ))}

      {TOOL_OPTIONS.map(opt => (
        <FilterChip
          key={opt.value}
          icon={opt.icon}
          label={opt.label}
          active={tools.includes(opt.value)}
          onToggle={() => onToggleTool(opt.value)}
        />
      ))}
    </div>
  )
}

interface FilterBarProps {
  search: string
  onSearchChange: (value: string) => void
  activeFilterCount: number
  onOpenDrawer: () => void
}

export function FilterBar({
  search,
  onSearchChange,
  activeFilterCount,
  onOpenDrawer,
}: FilterBarProps) {
  return (
    <div className="flex items-center rounded-full border border-gray-700 bg-gray-800 transition-colors focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-500/30">
      <div className="pointer-events-none flex shrink-0 items-center pl-4">
        <Icon path={mdiMagnify} size={0.75} aria-hidden={true} className="text-gray-400" />
      </div>

      <input
        type="search"
        value={search}
        onChange={e => onSearchChange(e.target.value)}
        placeholder="Search recipes…"
        className="min-w-0 flex-1 bg-transparent py-3 pr-2 pl-3 text-gray-100 text-sm placeholder:text-gray-500 focus:outline-none"
        aria-label="Search recipes"
      />

      {search && (
        <button
          type="button"
          onClick={() => onSearchChange("")}
          className="flex shrink-0 items-center px-2 text-gray-400 hover:text-gray-200"
          aria-label="Clear search"
        >
          <Icon path={mdiClose} size={0.6} aria-hidden={true} />
        </button>
      )}

      <div className="mx-1 h-5 w-px shrink-0 bg-gray-600" aria-hidden="true" />

      <button
        type="button"
        onClick={onOpenDrawer}
        className="relative flex shrink-0 items-center gap-1.5 rounded-full py-3 pr-4 pl-3 font-medium text-gray-300 text-sm hover:text-gray-100 focus:outline-none"
        aria-label={activeFilterCount > 0 ? `Filters, ${activeFilterCount} active` : "Filters"}
      >
        <Icon path={mdiTune} size={0.65} aria-hidden={true} />
        Filters
        {activeFilterCount > 0 && (
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 font-bold text-[10px] text-white">
            {activeFilterCount}
          </span>
        )}
      </button>
    </div>
  )
}

interface QuickFiltersProps {
  proteins: string[]
  onToggleProtein: (value: string) => void
  tools: string[]
  onToggleTool: (value: string) => void
  time: TimeBucket | null
  onSetTime: (value: TimeBucket | null) => void
  activeFilterCount: number
  onOpenDrawer: () => void
}

export function QuickFilters({
  proteins,
  onToggleProtein,
  tools,
  onToggleTool,
  activeFilterCount,
  onOpenDrawer,
}: QuickFiltersProps) {
  return (
    <fieldset className="-mx-4 -my-1.5 flex gap-2.5 overflow-x-auto border-none p-0 px-4 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <legend className="sr-only">Quick filters</legend>
      <Button
        variant="secondary"
        size="sm"
        onClick={onOpenDrawer}
        className="relative shrink-0 gap-1.5 rounded-full"
        aria-label={activeFilterCount > 0 ? `Filters, ${activeFilterCount} active` : "Filters"}
      >
        <Icon path={mdiTune} size={0.65} aria-hidden={true} />
        Filters
        {activeFilterCount > 0 && (
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 font-bold text-[10px] text-white">
            {activeFilterCount}
          </span>
        )}
      </Button>

      {PROTEIN_OPTIONS.map(opt => (
        <FilterChip
          key={opt.value}
          icon={opt.icon}
          label={opt.label}
          active={proteins.includes(opt.value)}
          onToggle={() => onToggleProtein(opt.value)}
        />
      ))}

      {TOOL_OPTIONS.map(opt => (
        <FilterChip
          key={opt.value}
          icon={opt.icon}
          label={opt.label}
          active={tools.includes(opt.value)}
          onToggle={() => onToggleTool(opt.value)}
        />
      ))}
    </fieldset>
  )
}

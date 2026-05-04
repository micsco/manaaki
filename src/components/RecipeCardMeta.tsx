import { mdiPotSteam, mdiTimerOutline, mdiToasterOven } from "@mdi/js"
import type { RecipeSummary } from "../api/generated/types.gen"
import { formatTime } from "../utils/recipe"
import { Icon } from "./Icon"
import { Badge, StarRating } from "./ui"

type ToolBadge = {
  key: string
  label: string
  icon: string
  match: string
  className: string
}

const TOOL_BADGES: ToolBadge[] = [
  {
    key: "slow-cooker",
    label: "Slow cooker",
    icon: mdiPotSteam,
    match: "slow cooker",
    className: "bg-amber-800/80 border-amber-600/50 text-amber-100 backdrop-blur-sm",
  },
  {
    key: "air-fryer",
    label: "Air fryer",
    icon: mdiToasterOven,
    match: "air fryer",
    className: "bg-sky-700/80 border-sky-500/50 text-sky-100 backdrop-blur-sm",
  },
]

function detectedTools(recipe: RecipeSummary): ToolBadge[] {
  const names = [
    ...(recipe.tools ?? []).map(t => t.name),
    ...(recipe.tags ?? []).map(t => t.name),
    ...(recipe.recipeCategory ?? []).map(c => c.name),
  ].map(n => n?.toLowerCase() ?? "")

  return TOOL_BADGES.filter(tb => names.some(n => n.includes(tb.match)))
}

export function RecipeCardTimeBadge({ recipe }: { recipe: RecipeSummary }) {
  const time = formatTime(recipe.totalTime)
  if (!time) return null

  return (
    <Badge variant="overlay" className="flex items-center gap-1">
      <Icon path={mdiTimerOutline} size={0.55} aria-hidden={true} />
      {time}
    </Badge>
  )
}

export function RecipeCardInfoBadges({ recipe }: { recipe: RecipeSummary }) {
  if (recipe.rating == null) return null

  return (
    <div className="flex items-center justify-end">
      <StarRating rating={recipe.rating} />
    </div>
  )
}

export function RecipeCardToolBadges({ recipe }: { recipe: RecipeSummary }) {
  const tools = detectedTools(recipe)
  if (tools.length === 0) return null

  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {tools.map(tool => (
        <Badge
          key={tool.key}
          variant="tag"
          className={`flex items-center gap-1 border ${tool.className}`}
        >
          <Icon path={tool.icon} size={0.55} aria-hidden={true} />
          {tool.label}
        </Badge>
      ))}
    </div>
  )
}

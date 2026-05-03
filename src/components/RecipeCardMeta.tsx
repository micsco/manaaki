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
}

const TOOL_BADGES: ToolBadge[] = [
  { key: "slow-cooker", label: "Slow cooker", icon: mdiPotSteam, match: "slow cooker" },
  { key: "air-fryer", label: "Air fryer", icon: mdiToasterOven, match: "air fryer" },
]

function detectedTools(recipe: RecipeSummary): ToolBadge[] {
  const names = [
    ...(recipe.tools ?? []).map(t => t.name),
    ...(recipe.tags ?? []).map(t => t.name),
    ...(recipe.recipeCategory ?? []).map(c => c.name),
  ].map(n => n?.toLowerCase() ?? "")

  return TOOL_BADGES.filter(tb => names.some(n => n.includes(tb.match)))
}

export function RecipeCardInfoBadges({ recipe }: { recipe: RecipeSummary }) {
  const time = formatTime(recipe.totalTime)

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        {time && (
          <Badge variant="overlay" className="flex items-center gap-1">
            <Icon path={mdiTimerOutline} size={0.55} aria-hidden={true} />
            {time}
          </Badge>
        )}
      </div>
      {recipe.rating != null && <StarRating rating={recipe.rating} />}
    </div>
  )
}

export function RecipeCardToolBadges({ recipe }: { recipe: RecipeSummary }) {
  const tools = detectedTools(recipe)
  if (tools.length === 0) return null

  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {tools.map(tool => (
        <Badge key={tool.key} variant="overlay-highlight" className="flex items-center gap-1">
          <Icon path={tool.icon} size={0.55} aria-hidden={true} />
          {tool.label}
        </Badge>
      ))}
    </div>
  )
}

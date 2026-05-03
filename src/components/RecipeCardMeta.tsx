import { mdiSilverwareForkKnife, mdiStarCircleOutline, mdiTimerOutline } from "@mdi/js"
import type { RecipeSummary } from "../api/generated/types.gen"
import { formatTime } from "../utils/recipe"
import { Icon } from "./Icon"
import { Badge } from "./ui"

export function RecipeCardMeta({ recipe }: { recipe: RecipeSummary }) {
  const time = formatTime(recipe.totalTime)
  const servings = recipe.recipeServings && recipe.recipeServings > 0 ? recipe.recipeServings : null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {time && (
        <Badge variant="tag" className="flex items-center gap-1">
          <Icon path={mdiTimerOutline} size={0.55} aria-hidden={true} />
          {time}
        </Badge>
      )}
      {servings && (
        <Badge variant="tag" className="flex items-center gap-1">
          <Icon path={mdiSilverwareForkKnife} size={0.55} aria-hidden={true} />
          {servings} {servings === 1 ? "serving" : "servings"}
        </Badge>
      )}
      {recipe.rating != null && (
        <Badge variant="rating" className="flex items-center gap-1">
          <Icon path={mdiStarCircleOutline} size={0.55} aria-hidden={true} />
          {recipe.rating.toFixed(1)}
        </Badge>
      )}
    </div>
  )
}

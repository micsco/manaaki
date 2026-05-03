import { mdiStar, mdiStarHalfFull, mdiStarOutline } from "@mdi/js"
import { Icon } from "../Icon"

interface StarRatingProps {
  rating: number
  max?: number
  size?: number
  className?: string
}

export function StarRating({ rating, max = 5, size = 0.6, className = "" }: StarRatingProps) {
  const stars = Array.from({ length: max }, (_, i) => {
    const fill = rating - i
    if (fill >= 0.75) return "full"
    if (fill >= 0.25) return "half"
    return "empty"
  })

  return (
    <span
      role="img"
      aria-label={`${rating} out of ${max} stars`}
      className={`flex items-center gap-px ${className}`}
    >
      {stars.map((type, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: stars are fixed-position, never reorder
        <Icon
          key={`star-${i}`}
          path={type === "full" ? mdiStar : type === "half" ? mdiStarHalfFull : mdiStarOutline}
          size={size}
          className={type === "empty" ? "text-white/30" : "text-yellow-400"}
          aria-hidden={true}
        />
      ))}
    </span>
  )
}

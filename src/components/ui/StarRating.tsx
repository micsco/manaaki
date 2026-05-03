import { mdiStar, mdiStarHalfFull, mdiStarOutline } from "@mdi/js"
import { Icon } from "../Icon"

interface StarRatingProps {
  rating: number
  max?: number
  size?: number
  className?: string
}

type StarType = { key: string; path: string; dim: boolean }

function buildStars(rating: number, max: number): StarType[] {
  return Array.from({ length: max }, (_, i) => {
    const fill = rating - i
    const path = fill >= 0.75 ? mdiStar : fill >= 0.25 ? mdiStarHalfFull : mdiStarOutline
    return { key: `s${i}`, path, dim: fill < 0.25 }
  })
}

export function StarRating({ rating, max = 5, size = 0.6, className = "" }: StarRatingProps) {
  const stars = buildStars(rating, max)

  return (
    <span
      role="img"
      aria-label={`${rating} out of ${max} stars`}
      className={`flex items-center gap-px leading-none ${className}`}
    >
      {stars.map(star => (
        <Icon
          key={star.key}
          path={star.path}
          size={size}
          className={star.dim ? "text-white/30" : "text-yellow-400"}
          aria-hidden={true}
        />
      ))}
    </span>
  )
}

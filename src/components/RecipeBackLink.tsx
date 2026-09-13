import { mdiChevronLeft } from "@mdi/js"
import { Link } from "@tanstack/react-router"

import { useNavigationDestinations } from "../contexts/NavigationContext"
import { useCurrentUser } from "../hooks/useCurrentUser"
import { Icon } from "./Icon"

export function RecipeBackLink() {
  const current = useCurrentUser()
  const { recipes, origin } = useNavigationDestinations()
  const destination = current && !current.isAnonymous ? origin : recipes
  const label =
    destination.to === "/plan"
      ? "Back to plan"
      : destination.to === "/shopping"
        ? "Back to shopping"
        : "All recipes"
  return (
    <Link
      {...destination}
      className="inline-flex min-h-11 min-w-11 items-center gap-1.5 rounded-full bg-black/40 px-3 py-2 text-sm font-medium text-white backdrop-blur-xs transition-colors hover:bg-black/60 focus-visible:outline-2 focus-visible:outline-orange-400 sm:px-4"
    >
      <Icon path={mdiChevronLeft} size={0.75} className="shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
    </Link>
  )
}

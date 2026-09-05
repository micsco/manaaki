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
      className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-black/40 px-4 py-2 text-sm font-medium text-white backdrop-blur-xs transition-colors hover:bg-black/60 focus-visible:outline-2 focus-visible:outline-orange-400"
    >
      <Icon path={mdiChevronLeft} size={0.75} aria-hidden />
      {label}
    </Link>
  )
}

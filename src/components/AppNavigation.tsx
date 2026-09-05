import { mdiBookOpenPageVariantOutline, mdiCalendarMonthOutline, mdiCartOutline } from "@mdi/js"
import { Link } from "@tanstack/react-router"

import { useNavigationDestinations } from "../contexts/NavigationContext"
import { Icon } from "./Icon"

export function AppNavigation({ mobile = false }: { mobile?: boolean }) {
  const { plan, recipes } = useNavigationDestinations()
  const destinations = [
    { ...plan, label: "Plan", icon: mdiCalendarMonthOutline },
    { ...recipes, label: "Recipes", icon: mdiBookOpenPageVariantOutline },
    { to: "/shopping" as const, label: "Shopping", icon: mdiCartOutline },
  ]
  return (
    <nav
      aria-label="Main navigation"
      data-mobile-navigation={mobile || undefined}
      className={
        mobile
          ? "fixed inset-x-0 bottom-0 z-30 border-t border-gray-800 bg-gray-950 pb-[env(safe-area-inset-bottom,0px)] md:hidden"
          : "hidden items-center gap-5 md:flex"
      }
    >
      <div
        className={
          mobile
            ? "mx-auto flex h-16 max-w-lg items-stretch justify-around"
            : "flex items-center gap-5"
        }
      >
        {destinations.map(({ label, icon, ...destination }) => (
          <Link
            key={label}
            {...destination}
            activeOptions={{ includeSearch: false }}
            activeProps={{ "aria-current": "page" }}
            className={
              mobile
                ? "flex min-w-20 flex-1 flex-col items-center justify-center gap-1 border-t-2 border-transparent text-xs font-medium text-gray-400 transition-colors hover:text-gray-100 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-orange-400 data-[status=active]:border-orange-400 data-[status=active]:text-orange-300"
                : "inline-flex min-h-11 items-center border-b-2 border-transparent px-1 text-sm font-medium text-gray-400 transition-colors hover:text-gray-100 focus-visible:outline-2 focus-visible:outline-orange-400 data-[status=active]:border-orange-400 data-[status=active]:text-gray-100"
            }
          >
            {mobile && <Icon path={icon} size={0.8} aria-hidden />}
            {label}
          </Link>
        ))}
      </div>
    </nav>
  )
}

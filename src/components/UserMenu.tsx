import { Menu } from "@base-ui/react/menu"
import {
  mdiAccount,
  mdiCalendarMonthOutline,
  mdiCartOutline,
  mdiInformationOutline,
  mdiLogout,
} from "@mdi/js"
import { Link } from "@tanstack/react-router"

import { useCurrentUser } from "../hooks/useCurrentUser"
import { Icon } from "./Icon"

export interface UserMenuProps {
  onOpenAbout?: () => void
}

function extractInitials(fullName?: string | null, username?: string | null): string {
  if (fullName) {
    const parts = fullName.trim().split(/\s+/)
    if (parts.length >= 2 && parts[0] && parts[parts.length - 1]) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    }
    if (parts.length === 1 && parts[0].length > 0) {
      return parts[0].slice(0, 2).toUpperCase()
    }
  }
  if (username && username.length > 0) {
    return username.slice(0, 2).toUpperCase()
  }
  return ""
}

export function UserMenu({ onOpenAbout }: UserMenuProps) {
  const current = useCurrentUser()
  if (!current) return null

  if (current.isAnonymous) {
    return (
      <a
        href="/api/auth/oauth"
        className="inline-flex min-h-11 items-center rounded-lg bg-orange-600 px-3.5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-orange-500 focus:ring-2 focus:ring-orange-500 focus:outline-hidden"
      >
        Sign in
      </a>
    )
  }

  const user = current.user
  const displayName = user?.fullName || user?.username || "Cook"
  const secondaryName = user?.fullName && user?.username ? user.username : null
  const initials = extractInitials(user?.fullName, user?.username)

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" })
    window.location.assign("/recipes")
  }

  return (
    <div className="flex items-center gap-2">
      <div className="hidden items-center gap-2 md:flex">
        <Link
          to="/shopping"
          className="inline-flex min-h-11 items-center rounded-lg bg-gray-800 px-3.5 py-1.5 text-sm font-medium text-gray-200 transition-colors hover:bg-gray-700 focus:ring-2 focus:ring-orange-500 focus:outline-hidden"
        >
          Shopping
        </Link>
        <Link
          to="/plan"
          className="inline-flex min-h-11 items-center rounded-lg bg-gray-800 px-3.5 py-1.5 text-sm font-medium text-gray-200 transition-colors hover:bg-gray-700 focus:ring-2 focus:ring-orange-500 focus:outline-hidden"
        >
          Meal Plan
        </Link>
      </div>

      <Menu.Root>
        <Menu.Trigger
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gray-700 bg-gray-800 text-sm font-semibold text-orange-400 transition-colors hover:border-gray-600 hover:bg-gray-700 focus:ring-2 focus:ring-orange-500 focus:outline-hidden"
          aria-label={`User menu for ${displayName}`}
        >
          {initials ? (
            <span>{initials}</span>
          ) : (
            <Icon path={mdiAccount} size={0.75} aria-hidden={true} />
          )}
        </Menu.Trigger>

        <Menu.Portal>
          <Menu.Positioner side="bottom" align="end" sideOffset={8}>
            <Menu.Popup className="z-50 min-w-56 rounded-2xl border border-gray-800 bg-gray-900/95 p-1.5 shadow-2xl backdrop-blur-md focus:outline-hidden">
              <div className="px-3.5 py-2.5">
                <p className="truncate text-sm font-semibold text-gray-100">{displayName}</p>
                {secondaryName && (
                  <p className="truncate text-xs text-gray-400">@{secondaryName}</p>
                )}
              </div>

              <hr className="my-1 border-gray-800" />

              <Menu.LinkItem
                render={<Link to="/shopping" />}
                closeOnClick
                className="flex min-h-11 items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-gray-200 transition-colors hover:bg-gray-800/80 focus:bg-gray-800/80 focus:outline-hidden"
              >
                <Icon
                  path={mdiCartOutline}
                  size={0.7}
                  className="text-gray-400"
                  aria-hidden={true}
                />
                Shopping List
              </Menu.LinkItem>

              <Menu.LinkItem
                render={<Link to="/plan" />}
                closeOnClick
                className="flex min-h-11 items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-gray-200 transition-colors hover:bg-gray-800/80 focus:bg-gray-800/80 focus:outline-hidden"
              >
                <Icon
                  path={mdiCalendarMonthOutline}
                  size={0.7}
                  className="text-gray-400"
                  aria-hidden={true}
                />
                Meal Plan
              </Menu.LinkItem>

              {onOpenAbout && (
                <>
                  <hr className="my-1 border-gray-800" />
                  <Menu.Item
                    onClick={onOpenAbout}
                    className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-gray-200 transition-colors hover:bg-gray-800/80 focus:bg-gray-800/80 focus:outline-hidden"
                  >
                    <Icon
                      path={mdiInformationOutline}
                      size={0.7}
                      className="text-gray-400"
                      aria-hidden={true}
                    />
                    About Manaaki
                  </Menu.Item>
                </>
              )}

              <hr className="my-1 border-gray-800" />

              <Menu.Item
                onClick={signOut}
                className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-950/40 hover:text-red-300 focus:bg-red-950/40 focus:text-red-300 focus:outline-hidden"
              >
                <Icon path={mdiLogout} size={0.7} aria-hidden={true} />
                Sign out
              </Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </div>
  )
}

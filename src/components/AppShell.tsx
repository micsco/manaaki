import { Link, useLocation } from "@tanstack/react-router"
import { useState, type ReactNode } from "react"

import { useCookMode } from "../contexts/CookModeContext"
import { useCurrentUser } from "../hooks/useCurrentUser"
import ManaakiLogo from "../manaaki.svg?react"
import { AboutModal } from "./AboutModal"
import { AppNavigation } from "./AppNavigation"
import { OfflineStatus } from "./OfflineStatus"
import { UserMenu } from "./UserMenu"

export function AppShell({ children }: { children: ReactNode }) {
  const { isCookMode } = useCookMode()
  const location = useLocation()
  const current = useCurrentUser()
  const [aboutOpen, setAboutOpen] = useState(false)
  const signedIn = !!current && !current.isAnonymous
  if (isCookMode && location.pathname.startsWith("/recipes/")) return <>{children}</>

  return (
    <div
      className={
        signedIn
          ? "min-h-dvh bg-gray-950 pb-[calc(4rem+env(safe-area-inset-bottom,0px))] md:pb-0"
          : "min-h-dvh bg-gray-950"
      }
    >
      <a
        href="#app-content"
        className="sr-only z-50 rounded-lg bg-gray-900 px-4 py-3 text-orange-300 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <header className="border-b border-gray-800 bg-gray-950 text-gray-100">
        <div className="mx-auto flex max-w-7xl items-center gap-8 px-4 py-2">
          <Link
            to={signedIn ? "/plan" : "/recipes"}
            aria-label="Manaaki home"
            className="flex min-h-11 items-center gap-2 rounded-lg text-xl font-bold text-gray-400 transition-colors hover:text-gray-200 focus-visible:outline-2 focus-visible:outline-orange-400"
          >
            <ManaakiLogo className="size-7 shrink-0" />
            Manaaki
          </Link>
          {signedIn && <AppNavigation />}
          <div className="ml-auto">
            <UserMenu onOpenAbout={() => setAboutOpen(true)} returnTo={location.href} />
          </div>
        </div>
      </header>
      <OfflineStatus />
      <div id="app-content" tabIndex={-1} className="outline-none">
        {children}
      </div>
      {signedIn && <AppNavigation mobile />}
      <AboutModal open={aboutOpen} onOpenChange={setAboutOpen} />
    </div>
  )
}

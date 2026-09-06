import type { ReactNode } from "react"

import { useCookMode } from "../contexts/CookModeContext"
import { CookModeToggle } from "./CookModeToggle"

interface KitchenLayoutProps {
  children: ReactNode
  title?: string
}

export function KitchenLayout({ children, title }: KitchenLayoutProps) {
  const { isCookMode } = useCookMode()

  if (isCookMode) {
    return (
      <div className="flex h-dvh flex-col bg-gray-950 app-safe-area pb-[env(safe-area-inset-bottom,0px)] text-gray-100">
        <header className="shrink-0 border-b border-gray-800 bg-gray-950/95 px-4 py-3 backdrop-blur-xs">
          <div className="mx-auto flex max-w-7xl items-center gap-3">
            {title && (
              <h1 className="flex-1 truncate text-lg font-semibold text-gray-100">{title}</h1>
            )}
            <CookModeToggle />
          </div>
        </header>
        <main className="min-h-0 flex-1">{children}</main>
      </div>
    )
  }

  return <>{children}</>
}

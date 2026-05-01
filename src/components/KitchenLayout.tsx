import type { ReactNode } from "react"
import { useCookMode } from "../contexts/CookModeContext"
import { CookModeToggle } from "./CookModeToggle"

interface KitchenLayoutProps {
  children: ReactNode
  title?: string
  backButton?: ReactNode
}

export function KitchenLayout({ children, title, backButton }: KitchenLayoutProps) {
  const { isCookMode } = useCookMode()

  if (isCookMode) {
    return (
      <div className="flex h-screen flex-col bg-gray-950 text-gray-100">
        <header className="shrink-0 border-gray-800 border-b bg-gray-950/95 px-4 py-3 backdrop-blur-sm">
          <div className="mx-auto flex max-w-7xl items-center gap-3">
            {backButton}
            {title && (
              <h1 className="flex-1 truncate font-semibold text-gray-100 text-lg">{title}</h1>
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

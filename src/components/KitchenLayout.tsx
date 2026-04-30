import type { ReactNode } from "react"
import { useCookMode } from "../contexts/CookModeContext"

interface KitchenLayoutProps {
  children: ReactNode
  title?: string
  backButton?: ReactNode
}

export function KitchenLayout({ children, title, backButton }: KitchenLayoutProps) {
  const { isCookMode } = useCookMode()

  if (isCookMode) {
    // Cook mode: minimal sticky header, full-width content
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100">
        <header className="sticky top-0 z-10 border-gray-800 border-b bg-gray-950/95 px-4 py-3 backdrop-blur-sm">
          <div className="mx-auto flex max-w-7xl items-center gap-3">
            {backButton}
            {title && <h1 className="truncate font-semibold text-gray-100 text-lg">{title}</h1>}
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </div>
    )
  }

  // Normal mode: recipe page owns its own layout entirely
  return <>{children}</>
}

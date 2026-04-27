import type { ReactNode } from "react"
import { useCookMode } from "../contexts/CookModeContext"

interface KitchenLayoutProps {
  children: ReactNode
  title?: string
  backButton?: ReactNode
  actions?: ReactNode
}

export function KitchenLayout({ children, title, backButton, actions }: KitchenLayoutProps) {
  const { isCookMode } = useCookMode()

  if (isCookMode) {
    // Cook mode: minimal UI, maximize content area
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100">
        {/* Minimal header in cook mode */}
        <header className="sticky top-0 z-10 bg-gray-950/95 backdrop-blur-sm border-b border-gray-800 px-4 py-2">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div className="flex items-center gap-3">
              {backButton}
              {title && <h1 className="text-lg font-semibold text-gray-100 truncate">{title}</h1>}
            </div>
            <div className="flex items-center gap-2">{actions}</div>
          </div>
        </header>

        {/* Full-width content for cook mode */}
        <main className="max-w-none">{children}</main>
      </div>
    )
  }

  // Normal mode: centered layout with proper spacing
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  )
}

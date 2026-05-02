import { type RenderOptions, render } from "@testing-library/react"
import { NuqsTestingAdapter } from "nuqs/adapters/testing"
import type { ReactElement, ReactNode } from "react"
import { CookModeProvider } from "../contexts/CookModeContext"

function AllProviders({ children }: { children: ReactNode }) {
  return (
    <NuqsTestingAdapter>
      <CookModeProvider>{children}</CookModeProvider>
    </NuqsTestingAdapter>
  )
}

function renderWithProviders(ui: ReactElement, options?: RenderOptions) {
  return render(ui, { wrapper: AllProviders, ...options })
}

export function CookModeWrapper({
  children,
  cookMode = false,
}: {
  children: ReactNode
  cookMode?: boolean
}) {
  return (
    <NuqsTestingAdapter searchParams={cookMode ? "cook=true" : ""}>
      <CookModeProvider>{children}</CookModeProvider>
    </NuqsTestingAdapter>
  )
}

export * from "@testing-library/react"
export { renderWithProviders as render }

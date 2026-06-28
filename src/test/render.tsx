import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { type RenderOptions, render } from "@testing-library/react"
import { NuqsTestingAdapter } from "nuqs/adapters/testing"
import type { ReactElement, ReactNode } from "react"
import { CookModeProvider } from "../contexts/CookModeContext"

function AllProviders({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <NuqsTestingAdapter>
        <CookModeProvider>{children}</CookModeProvider>
      </NuqsTestingAdapter>
    </QueryClientProvider>
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

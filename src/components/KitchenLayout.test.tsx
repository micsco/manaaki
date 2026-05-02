import { NuqsTestingAdapter } from "nuqs/adapters/testing"
import { describe, expect, it } from "vitest"
import { CookModeProvider } from "../contexts/CookModeContext"
import { render, screen } from "../test/render"
import { KitchenLayout } from "./KitchenLayout"

function CookModeWrapper({
  children,
  cookMode = false,
}: {
  children: React.ReactNode
  cookMode?: boolean
}) {
  return (
    <NuqsTestingAdapter searchParams={cookMode ? "cook=true" : ""}>
      <CookModeProvider>{children}</CookModeProvider>
    </NuqsTestingAdapter>
  )
}

describe("KitchenLayout", () => {
  describe("normal mode", () => {
    it("renders children without a header wrapper", () => {
      render(
        <KitchenLayout>
          <p>Content</p>
        </KitchenLayout>
      )
      expect(screen.getByText("Content")).toBeInTheDocument()
      expect(screen.queryByRole("banner")).not.toBeInTheDocument()
    })

    it("does not render title in normal mode", () => {
      render(
        <KitchenLayout title="My Recipe">
          <p>body</p>
        </KitchenLayout>
      )
      expect(screen.queryByText("My Recipe")).not.toBeInTheDocument()
    })
  })

  describe("cook mode", () => {
    it("renders a header element in cook mode", () => {
      render(
        <KitchenLayout>
          <p>Content</p>
        </KitchenLayout>,
        { wrapper: ({ children }) => <CookModeWrapper cookMode>{children}</CookModeWrapper> }
      )
      expect(screen.getByRole("banner")).toBeInTheDocument()
    })

    it("renders the title in the header when in cook mode", () => {
      render(
        <KitchenLayout title="Pasta Carbonara">
          <p>body</p>
        </KitchenLayout>,
        { wrapper: ({ children }) => <CookModeWrapper cookMode>{children}</CookModeWrapper> }
      )
      expect(screen.getByText("Pasta Carbonara")).toBeInTheDocument()
    })

    it("renders children inside a main element", () => {
      render(
        <KitchenLayout>
          <p>Content</p>
        </KitchenLayout>,
        { wrapper: ({ children }) => <CookModeWrapper cookMode>{children}</CookModeWrapper> }
      )
      expect(screen.getByRole("main")).toBeInTheDocument()
      expect(screen.getByText("Content")).toBeInTheDocument()
    })

    it("renders the back button when provided", () => {
      render(
        <KitchenLayout backButton={<a href="/recipes">Back</a>}>
          <p>body</p>
        </KitchenLayout>,
        { wrapper: ({ children }) => <CookModeWrapper cookMode>{children}</CookModeWrapper> }
      )
      expect(screen.getByRole("link", { name: /back/i })).toBeInTheDocument()
    })

    it("renders the cook mode toggle in the header", () => {
      render(
        <KitchenLayout>
          <p>body</p>
        </KitchenLayout>,
        { wrapper: ({ children }) => <CookModeWrapper cookMode>{children}</CookModeWrapper> }
      )
      expect(screen.getByRole("button", { name: /exit cook mode/i })).toBeInTheDocument()
    })
  })
})

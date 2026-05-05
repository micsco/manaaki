import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const manifest = JSON.parse(
  readFileSync(resolve(__dirname, "../../public/manifest.webmanifest"), "utf-8")
)

describe("manifest.webmanifest", () => {
  it("includes a 192x192 PNG icon", () => {
    const icon = manifest.icons.find(
      (i: { sizes: string; type: string }) => i.sizes === "192x192" && i.type === "image/png"
    )
    expect(icon).toBeDefined()
    expect(icon.src).toMatch(/\.png$/)
  })

  it("includes a 512x512 PNG icon", () => {
    const icon = manifest.icons.find(
      (i: { sizes: string; type: string }) => i.sizes === "512x512" && i.type === "image/png"
    )
    expect(icon).toBeDefined()
    expect(icon.src).toMatch(/\.png$/)
  })

  it("includes a maskable icon", () => {
    const icon = manifest.icons.find((i: { purpose?: string }) => i.purpose === "maskable")
    expect(icon).toBeDefined()
    expect(icon.type).toBe("image/png")
  })

  it("retains the SVG icon as a fallback", () => {
    const icon = manifest.icons.find((i: { type: string }) => i.type === "image/svg+xml")
    expect(icon).toBeDefined()
  })
})

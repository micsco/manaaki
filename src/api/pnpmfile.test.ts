import { createRequire } from "node:module"

import { describe, expect, it } from "vitest"

type Manifest = {
  name: string
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

const { hooks } = createRequire(import.meta.url)("../../.pnpmfile.cjs") as {
  hooks: { readPackage: (pkg: Manifest) => Manifest }
}

const openapiTsManifest: Manifest = {
  name: "@hey-api/openapi-ts",
  dependencies: { commander: "15.0.0" },
  peerDependencies: { typescript: ">=5.5.3 || >=6.0.0 || 6.0.1-rc" },
}

describe(".pnpmfile.cjs readPackage", () => {
  it("pins a TypeScript 6 dependency for @hey-api/openapi-ts", () => {
    const result = hooks.readPackage(openapiTsManifest)

    expect(result.dependencies).toEqual({ commander: "15.0.0", typescript: "6.0.3" })
  })

  it("removes the TypeScript peer so pnpm stops resolving the root TypeScript 7", () => {
    const result = hooks.readPackage(openapiTsManifest)

    expect(result.peerDependencies).toEqual({})
  })

  it("does not mutate the manifest it is given", () => {
    hooks.readPackage(openapiTsManifest)

    expect(openapiTsManifest.dependencies).toEqual({ commander: "15.0.0" })
    expect(openapiTsManifest.peerDependencies).toEqual({
      typescript: ">=5.5.3 || >=6.0.0 || 6.0.1-rc",
    })
  })

  it("leaves other packages untouched", () => {
    const manifest: Manifest = {
      name: "@svgr/core",
      peerDependencies: { typescript: ">=4.9.5" },
    }

    expect(hooks.readPackage(manifest)).toBe(manifest)
  })
})

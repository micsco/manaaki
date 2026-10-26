import { readFileSync } from "node:fs"

import { expect, it } from "vitest"

const dockerfile = readFileSync(new URL("../../Dockerfile", import.meta.url), "utf8")

function finalStage(contents: string): string {
  const stages = contents.split(/^FROM /m)
  return stages[stages.length - 1]
}

it("runs the server in production mode so React and the router use their production builds", () => {
  expect(finalStage(dockerfile)).toMatch(/^ENV NODE_ENV=production$/m)
  expect(finalStage(dockerfile)).toContain("AS serve")
})

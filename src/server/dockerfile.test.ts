import { readFileSync } from "node:fs"

import { expect, it } from "vitest"

const dockerfile = readFileSync(new URL("../../Dockerfile", import.meta.url), "utf8")
const entrypoint = readFileSync(new URL("../../docker-entrypoint.sh", import.meta.url), "utf8")
const serverEntry = readFileSync(new URL("../../server.js", import.meta.url), "utf8")
const nginxConf = readFileSync(new URL("../../nginx.conf.template", import.meta.url), "utf8")
const securityHeaders = readFileSync(
  new URL("../../nginx-security-headers.conf", import.meta.url),
  "utf8"
)

function finalStage(contents: string): string {
  const stages = contents.split(/^FROM /m)
  return stages[stages.length - 1]
}

it("runs the server in production mode so React and the router use their production builds", () => {
  expect(finalStage(dockerfile)).toMatch(/^ENV NODE_ENV=production$/m)
  expect(finalStage(dockerfile)).toContain("AS serve")
})

it("pins the PostHog CLI version and deletes source maps before shipping dist/client", () => {
  expect(dockerfile).not.toContain("@posthog/cli@latest")
  expect(dockerfile).toMatch(/find dist\/client -name '\*\.map' -delete/)
})

it("drops Node privileges to the unprivileged nginx user and binds loopback only", () => {
  expect(dockerfile).toContain("su-exec")
  expect(entrypoint).toContain("su-exec nginx node /app/server.js")
  expect(serverEntry).toMatch(/hostname:\s*"127\.0\.0\.1"/)
})

it("includes security headers and blocks .map files in nginx", () => {
  expect(dockerfile).toContain("nginx-security-headers.conf")
  expect(nginxConf).toContain("include /etc/nginx/snippets/security-headers.conf;")
  expect(nginxConf).toMatch(/location ~\* \\\.map\$/)
  expect(securityHeaders).toContain("frame-ancestors 'self' https://jarvis.77bb.digikiwi.net")
  expect(securityHeaders).not.toContain("X-Frame-Options")
})

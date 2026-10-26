import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { chmod, mkdtemp, mkdir, readFile, rm, writeFile, access } from "node:fs/promises"
import { createServer } from "node:http"
import { tmpdir } from "node:os"
import { join } from "node:path"
import process from "node:process"
import { setTimeout } from "node:timers/promises"

const directory = await mkdtemp(join(tmpdir(), "manaaki-nginx-test-"))
await chmod(directory, 0o755)
const root = join(directory, "html")
const configuration = join(directory, "nginx.conf")
const template = await readFile(process.argv[2], "utf8")

const upstreamRequests = []
const upstream = createServer((request, response) => {
  upstreamRequests.push({ url: request.url, headers: request.headers })
  response.setHeader("Set-Cookie", "upstream=1; Path=/")
  response.end("upstream")
})
await new Promise(resolve => upstream.listen(0, "127.0.0.1", resolve))
const upstreamOrigin = `http://127.0.0.1:${upstream.address().port}`

function substitute(text, original, replacement) {
  assert.ok(text.includes(original), `nginx template no longer contains: ${original}`)
  return text.replace(original, replacement)
}

const server = [
  ["listen 80;", "listen 18080;"],
  ["root /app/html;", `root ${root};`],
  ['set $ssr_server "http://127.0.0.1:3000";', `set $ssr_server "${upstreamOrigin}";`],
  [
    'set $posthog_assets "https://eu-assets.i.posthog.com";',
    `set $posthog_assets "${upstreamOrigin}";`,
  ],
  ['set $posthog "https://eu.i.posthog.com";', `set $posthog "${upstreamOrigin}";`],
].reduce((text, [original, replacement]) => substitute(text, original, replacement), template)

const credentials = { Cookie: "__Host-manaaki_session=sealed", Authorization: "Bearer secret" }

async function proxied(path) {
  upstreamRequests.length = 0
  const response = await fetch(`http://127.0.0.1:18080${path}`, { headers: credentials })
  await response.arrayBuffer()
  assert.equal(response.status, 200)
  assert.equal(upstreamRequests.length, 1)
  return { response, request: upstreamRequests[0] }
}
await mkdir(join(root, "assets"), { recursive: true })
await writeFile(join(root, "assets", "existing.css"), "body { color: red; }")
await writeFile(
  configuration,
  `pid ${directory}/nginx.pid;
error_log stderr;
events {}
http {
  access_log off;
  include /etc/nginx/mime.types;
  ${server}
}`
)
const args = ["-p", directory, "-c", configuration]
let started = false
try {
  execFileSync("nginx", ["-t", ...args], { stdio: "inherit" })
  execFileSync("nginx", args, { stdio: "inherit" })
  started = true
  const missing = await fetch("http://127.0.0.1:18080/assets/new.css")
  assert.equal(missing.status, 404)
  assert.equal(missing.headers.get("cache-control"), "no-store")
  assert.equal(missing.headers.get("expires"), null)
  await missing.arrayBuffer()
  await writeFile(join(root, "assets", "new.css"), "body { color: blue; }")
  for (const name of ["existing", "new"]) {
    const response = await fetch(`http://127.0.0.1:18080/assets/${name}.css`)
    assert.equal(response.status, 200)
    assert.match(response.headers.get("content-type"), /text\/css/)
    assert.match(response.headers.get("cache-control"), /immutable/)
    assert.doesNotMatch(response.headers.get("cache-control"), /no-store/)
    assert.match(await response.text(), /body/)
  }
  console.log("nginx asset cache checks passed")

  for (const [path, upstreamPath, upstreamHost] of [
    ["/ingest/e/?ip=0", "/e/?ip=0", "eu.i.posthog.com"],
    ["/ingest/flags/?v=2", "/flags/?v=2", "eu.i.posthog.com"],
    ["/ingest/static/array.js", "/static/array.js", "eu-assets.i.posthog.com"],
    ["/ingest/array/token/config.js", "/array/token/config.js", "eu-assets.i.posthog.com"],
  ]) {
    const { response, request } = await proxied(path)
    assert.equal(request.url, upstreamPath)
    assert.equal(request.headers.host, upstreamHost)
    assert.equal(request.headers.cookie, undefined, `${path} forwarded the Cookie header`)
    assert.equal(
      request.headers.authorization,
      undefined,
      `${path} forwarded the Authorization header`
    )
    assert.deepEqual(response.headers.getSetCookie(), [], `${path} relayed an upstream Set-Cookie`)
  }
  console.log("nginx analytics proxy credential checks passed")

  for (const path of ["/api/auth/me", "/api/manaaki/recipe-versions/draft", "/plan"]) {
    const { response, request } = await proxied(path)
    assert.equal(request.url, path)
    assert.equal(request.headers.cookie, credentials.Cookie)
    assert.deepEqual(response.headers.getSetCookie(), ["upstream=1; Path=/"])
  }
  console.log("nginx app proxy session cookie checks passed")
} finally {
  if (started) execFileSync("nginx", ["-s", "quit", ...args], { stdio: "inherit" })
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      await access(join(directory, "nginx.pid"))
    } catch {
      break
    }
    await setTimeout(20)
  }
  await rm(directory, { recursive: true, force: true })
  upstream.closeAllConnections()
  await new Promise(resolve => upstream.close(resolve))
}

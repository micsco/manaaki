import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { chmod, mkdtemp, mkdir, readFile, rm, writeFile, access } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import process from "node:process"
import { setTimeout } from "node:timers/promises"

const directory = await mkdtemp(join(tmpdir(), "manaaki-nginx-test-"))
await chmod(directory, 0o755)
const root = join(directory, "html")
const configuration = join(directory, "nginx.conf")
const template = await readFile(process.argv[2], "utf8")
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
  ${template.replace("listen 80;", "listen 18080;").replace("root /app/html;", `root ${root};`)}
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
}

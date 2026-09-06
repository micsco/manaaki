import { createHash } from "node:crypto"
import { readdir, readFile } from "node:fs/promises"
import { resolve } from "node:path"

import { build } from "vite"

const directory = resolve("dist/client")
const files = (await readdir(directory, { recursive: true }))
  .filter(file => /\.(js|css|woff2|png|svg)$/.test(file) && file !== "sw.js")
  .concat("offline-shell.html")
  .sort()
const revision = createHash("sha256")
for (const file of files) revision.update(await readFile(resolve(directory, file)))

await build({
  configFile: false,
  publicDir: false,
  define: {
    __PRECACHE__: JSON.stringify(files.map(file => `/${file}`)),
    __REVISION__: JSON.stringify(revision.digest("hex").slice(0, 16)),
  },
  build: {
    outDir: directory,
    emptyOutDir: false,
    lib: {
      entry: resolve("src/pwa/worker.ts"),
      formats: ["iife"],
      name: "ManaakiWorker",
      fileName: () => "sw.js",
    },
  },
})

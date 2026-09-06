import { readFile } from "node:fs/promises"
import { createServer } from "node:http"
import { extname, resolve, sep } from "node:path"

const root = resolve("dist/client")
const id = "00000000-0000-4000-8000-000000000001"
const recipe = {
  id,
  slug: "pasta-carbonara",
  name: "Pasta Carbonara",
  description: "A fixture recipe",
  image: "1",
  recipeServings: 4,
  recipeIngredient: [
    {
      referenceId: "one",
      display: "200g spaghetti",
      quantity: 200,
      food: { name: "spaghetti" },
      unit: { name: "g" },
    },
  ],
  recipeInstructions: [{ id: "step", text: "Cook for 10 minutes." }],
  recipeCategory: [],
  tags: [],
  notes: [],
}
let checked = false
let disconnected = false

createServer(async (request, response) => {
  const url = new URL(request.url, "http://localhost:4174")
  if (url.pathname === "/__network") {
    disconnected = url.searchParams.get("offline") === "true"
    response.end("ok")
    return
  }
  if (disconnected) {
    request.socket.destroy()
    return
  }
  response.setHeader("Cache-Control", "no-store")
  if (url.pathname.startsWith("/api/media/")) {
    response.setHeader("Content-Type", "image/png")
    response.end(await readFile(resolve(root, "manaaki-192.png")))
    return
  }
  if (url.pathname.startsWith("/api/")) {
    response.setHeader("Content-Type", "application/json")
    let data = { items: [], total_pages: 1 }
    if (url.pathname === "/api/auth/me")
      data = {
        user: { id: "fixture-user", fullName: "Fixture Cook", groupSlug: "fixture" },
        isAnonymous: false,
      }
    if (url.pathname === "/api/recipes") data = { items: [recipe], total_pages: 1 }
    if (url.pathname.startsWith("/api/recipes/")) data = recipe
    if (url.pathname === "/api/recipes/create/url" && request.method === "POST") data = recipe.slug
    if (url.pathname === "/api/households/mealplans")
      data = {
        items: [
          {
            id: 1,
            date: url.searchParams.get("start_date"),
            entryType: "dinner",
            recipeId: id,
            recipe,
          },
        ],
      }
    if (url.pathname === "/api/households/shopping/lists")
      data = { items: [{ id: "list", name: "Shopping" }] }
    if (url.pathname === "/api/households/shopping/items/item")
      data = { id: "item", shoppingListId: "list", display: "Spaghetti", checked }
    if (url.pathname === "/api/households/shopping/items/item" && request.method === "PUT") {
      let body = ""
      for await (const chunk of request) body += chunk
      checked = JSON.parse(body).checked
      data = {
        updatedItems: [{ id: "item", shoppingListId: "list", display: "Spaghetti", checked }],
      }
    }
    if (url.pathname === "/api/households/shopping/lists/list")
      data = {
        id: "list",
        name: "Shopping",
        listItems: [{ id: "item", shoppingListId: "list", display: "Spaghetti", checked }],
        recipeReferences: [],
      }
    response.end(JSON.stringify(data))
    return
  }
  const path = resolve(root, `.${url.pathname}`)
  if (!path.startsWith(root + sep)) {
    response.writeHead(400).end()
    return
  }
  try {
    const file = extname(path) ? path : resolve(root, "offline-shell.html")
    const content = await readFile(file)
    response.setHeader(
      "Content-Type",
      {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".png": "image/png",
        ".svg": "image/svg+xml",
        ".webmanifest": "application/manifest+json",
        ".woff2": "font/woff2",
      }[extname(file)] ?? "application/json"
    )
    response.end(content)
  } catch {
    response.writeHead(404).end()
  }
}).listen(4174, "127.0.0.1")

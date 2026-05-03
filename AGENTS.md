# What's Cookin' — Agent Notes

## Project

TanStack Start SPA (React 19, TypeScript 6, Vite 8). Connects to a self-hosted
Mealie instance via a generated `@hey-api/openapi-ts` client.

### API proxy architecture

The Mealie API token lives **only on the server** — it is never in the JS bundle.
In production, nginx (inside the container) acts as a reverse proxy: it adds the
`Authorization: Bearer` header to `/api/*` requests and only exposes a GET-only
allowlist of Mealie endpoints. See `.devin/skills/nginx-api-proxy/SKILL.md` for
full documentation.

**Runtime environment variables** (set in Dokploy → Environment, not build args):

| Variable | Purpose |
|----------|---------|
| `MEALIE_API_TOKEN` | Long-lived Mealie API token |
| `MEALIE_INTERNAL_URL` | Docker-internal URL for Mealie (e.g. `http://scottfamilynz-mealie-cvtizz-mealie-1:9000`) |

For local development, copy `.env.example` to `.env` and set both vars. The Vite
dev proxy in `vite.config.ts` injects the token identically to nginx.

**Do not** set `VITE_MEALIE_API_TOKEN` or `VITE_MEALIE_BASE_URL` — those were
removed to prevent the token from leaking into the JS bundle.

## Code Style

No comments. Code should be self-explanatory through clear naming and structure.

- Use descriptive variable and function names
- Only add a comment if it explains a non-obvious workaround or external constraint that cannot be expressed in code
- If code needs a comment to be understood, refactor it first

## Skills

Agent skills from `vercel-labs/agent-skills` are symlinked under `.devin/skills/`.
The symlinks point into `.agents/` (gitignored). After cloning, restore them with:

```
npx skills add vercel-labs/agent-skills --yes
```

To update to the latest versions:

```
npx skills update vercel-labs/agent-skills --yes
```

## Commands

| Task                  | Command                  |
| --------------------- | ------------------------ |
| Dev server            | `pnpm dev`               |
| Type-check            | `pnpm type-check`        |
| Biome check           | `pnpm check`             |
| Biome check & fix     | `pnpm check:fix`         |
| Biome format          | `pnpm format`            |
| Full validation       | `pnpm validate`          |
| Build                 | `pnpm build`             |
| Run unit tests        | `pnpm test`              |
| Run tests (watch)     | `pnpm test:watch`        |
| Run e2e tests         | `pnpm test:e2e`          |
| Regenerate API client | `pnpm generate`          |

## Route File Constraints

Route files in `src/routes/` are processed by TanStack Router's SSR module runner. Two hard rules:

- **Only export `Route`** from a route file. Any other named export causes the module runner to re-evaluate the file in an SSR context, which breaks CJS-packaged dependencies (e.g. `@mdi/react`) with a misleading "Named export not found" error. Extract shared components into `src/components/` instead.
- **Prefix test files with `-`** (e.g. `-recipes.index.test.tsx`) so the router ignores them. Files without this prefix that don't export `Route` will trigger a warning and be excluded from the route tree anyway, but the `-` prefix is explicit and avoids the warning.

## Tests

**Every code change must include tests.** This is non-negotiable.

- New utility functions → unit tests in a co-located `.test.ts` file
- New or modified components → render/interaction tests in a co-located `.test.tsx` file
- Bug fixes → a test that fails before the fix and passes after
- See `.agents/skills/react-testing/AGENTS.md` for the full testing guide

## Before Committing

Run these in order before staging any commit. The pre-commit hook runs them
automatically, but running manually first saves time:

```bash
pnpm check:fix    # lint + format with auto-fix (stages may change files)
pnpm type-check   # TypeScript — must be clean
pnpm test         # unit tests — all must pass
```

## Git Hooks (prek)

Git hooks are managed by **prek** — config lives in `prek.toml`, not in any
shell scripts. See `.agents/skills/prek/AGENTS.md` for the full reference.

| Hook | Stage | What it runs |
|------|-------|-------------|
| `biome-check` | pre-commit | `pnpm check:fix` |
| `type-check` | pre-commit | `pnpm type-check` |
| `test` | pre-push | `pnpm test` |
| `build` | pre-push | `pnpm build` |

To run hooks manually: `npx prek run --stage pre-commit --all-files`

<!-- intent-skills:start -->

# Skill mappings - load `use` with `npx @tanstack/intent@latest load <use>`.

skills:

- when: "adding api endpoints, changing the mealie token, nginx proxy config, allowed routes, internal docker url, mealie connectivity, or MEALIE_API_TOKEN / MEALIE_INTERNAL_URL"
  use: "nginx-api-proxy"

- when: "working with routes, route trees, createRoute, createRootRoute, file naming conventions, or general router concepts"
  use: "@tanstack/router-core#router-core"
- when: "protecting routes, redirecting unauthenticated users, beforeLoad guards, RBAC, or integrating an auth provider"
  use: "@tanstack/router-core#router-core/auth-and-guards"
- when: "splitting route bundles, using .lazy.tsx files, createLazyFileRoute, or deferring non-critical route code"
  use: "@tanstack/router-core#router-core/code-splitting"
- when: "fetching data in loaders, caching with staleTime/gcTime, pending/error components, or deferred data"
  use: "@tanstack/router-core#router-core/data-loading"
- when: "using Link, useNavigate, preloading, navigation blocking, scroll restoration, or active link styles"
  use: "@tanstack/router-core#router-core/navigation"
- when: "handling 404s, not-found components, error boundaries, CatchBoundary, or route masking"
  use: "@tanstack/router-core#router-core/not-found-and-errors"
- when: "working with dynamic path segments ($param), splat routes, optional params, or useParams"
  use: "@tanstack/router-core#router-core/path-params"
- when: "reading or writing URL search params, validateSearch, Zod adapters, or custom serialization"
  use: "@tanstack/router-core#router-core/search-params"
- when: "setting up SSR, streaming, renderRouterToStream, or server-side data hydration"
  use: "@tanstack/router-core#router-core/ssr"
- when: "fixing TypeScript errors in router types, using Register declaration, getRouteApi, or LinkProps utilities"
  use: "@tanstack/router-core#router-core/type-safety"

- when: "writing tests, setting up vitest, react testing library, playwright, unit tests, component tests, hook tests, e2e tests, mocking, userEvent, screen queries, jest-dom, or debugging act warnings"
  use: "react-testing"

- when: "adding, removing, or modifying git hooks, changing hook stages, debugging hooks not running, reinstalling prek after cloning, or understanding what runs on commit or push"
  use: "prek"
<!-- intent-skills:end -->

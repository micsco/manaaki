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

## Commands

| Task                  | Command             |
| --------------------- | ------------------- |
| Dev server            | `pnpm dev`          |
| Safe dev server       | `pnpm dev:safe`     |
| Type-check            | `pnpm tsc --noEmit` |
| Biome check           | `pnpm check`        |
| Biome check & fix     | `pnpm check:fix`    |
| Biome format          | `pnpm format`       |
| Biome format check    | `pnpm format:check` |
| Full validation       | `pnpm validate`     |
| Build                 | `pnpm build`        |
| Safe build            | `pnpm build:safe`   |
| Pre-push validation   | `pnpm pre-push`     |
| Regenerate API client | `pnpm generate`     |

## Code Quality & Validation

This project uses Biome for comprehensive validation to catch errors early:

### **Pre-commit Hooks**
- **Biome**: Catches TypeScript/React errors, style issues, and formats code
- **TypeScript**: Validates type safety before commits
- **Commitlint**: Enforces conventional commit messages

### **Development Scripts**
- **`pnpm dev:safe`**: Runs full validation before starting dev server
- **`pnpm build:safe`**: Comprehensive validation before building
- **`pnpm validate`**: Runs type-check and Biome check
- **`pnpm check`**: Biome linting and formatting check
- **`pnpm check:fix`**: Biome linting and formatting with auto-fix
- **`pnpm pre-push`**: Full validation before pushing changes

### **VS Code Integration**
- Auto-format on save with Biome
- Auto-fix Biome issues on save
- TypeScript import organization
- Tailwind CSS class completion
- Recommended extensions auto-installed

### **CI/CD Pipeline**
- **GitHub Actions**: Runs `biome ci` for optimized CI validation on every PR/push
- **Type checking**: Ensures type safety across the entire codebase
- **Biome validation**: Enforces code quality standards with CI-optimized reporting
- **Build verification**: Guarantees the application builds successfully

### **Validation Rules**
- **TypeScript**: Strict mode enabled, no implicit any
- **Biome Linter**: React 19+ rules, accessibility checks, complexity analysis, security checks
- **Biome Formatter**: Consistent formatting with double quotes, space indentation, 100 char line width
- **Git hooks**: Prevent broken code from being committed
- **VCS Integration**: Automatically respects .gitignore patterns

### **Configuration Features**
- **JSON Schema**: Full editor autocomplete and validation support
- **File Scoping**: Processes only `src/**/*` with intelligent overrides
- **Generated Files**: Automatically excludes API client and route tree generated files
- **CSS Handling**: Tailwind CSS files excluded from linting due to directive parsing
- **CI Optimization**: Uses `biome ci` command for better CI/CD integration

### **Error Prevention**
- JSX syntax errors caught during development
- Missing imports detected automatically  
- Unused variables and dead code eliminated
- Accessibility issues identified early
- Type mismatches caught before runtime
- Code complexity warnings for maintainability
- Security vulnerabilities detected automatically

This Biome-powered setup ensures that errors are caught immediately during development with fast, parallelized tooling, preventing them from reaching production.

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
<!-- intent-skills:end -->

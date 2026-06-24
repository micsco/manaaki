/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

// Module augmentation: expose `server.handlers` on TanStack Start file routes.
// @tanstack/start-client-core adds this augmentation, but pnpm doesn't hoist it to the
// top-level node_modules for this router-core version, so we replicate the minimal shape here.
// See: https://github.com/TanStack/router/blob/main/packages/start-client-core/src/serverRoute.ts
type _ServerHandlerCtx = { request: Request; params: Record<string, string>; pathname: string }
type _ServerHandlerFn = (ctx: _ServerHandlerCtx) => Response | Promise<Response>
type _ServerHandlers = Partial<
  Record<"GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS" | "HEAD" | "ANY", _ServerHandlerFn>
>

import type { AnyRoute } from "@tanstack/router-core"

declare module "@tanstack/router-core" {
  interface FilebaseRouteOptionsInterface<
    TRegister,
    TParentRoute extends AnyRoute = AnyRoute,
    TId extends string = string,
    TPath extends string = string,
    TSearchValidator = undefined,
    TParams = Record<string, never>,
    TLoaderDeps extends Record<string, unknown> = Record<string, never>,
    TLoaderFn = undefined,
    TRouterContext = Record<string, never>,
    TRouteContextFn = unknown,
    TBeforeLoadFn = unknown,
    TRemountDepsFn = unknown,
    TSSR = unknown,
    TServerMiddlewares = unknown,
    THandlers = undefined,
  > {
    server?: {
      middleware?: readonly unknown[]
      handlers?: _ServerHandlers
    }
  }
}

interface ImportMetaEnv {
  // Required at build time — Vite refuses to start without these.
  readonly VITE_PUBLIC_POSTHOG_PROJECT_TOKEN: string
  readonly VITE_PUBLIC_POSTHOG_HOST: string
  // Set in the Dockerfile build step from git + the docker build clock.
  // Undefined in dev (vite dev never sets them), so render conditionally.
  readonly VITE_BUILD_GIT_SHA?: string
  readonly VITE_BUILD_GIT_SHORT_SHA?: string
  readonly VITE_BUILD_TIME?: string
}

// biome-ignore lint/correctness/noUnusedVariables: global ImportMeta augmentation for Vite
interface ImportMeta {
  readonly env: ImportMetaEnv
}

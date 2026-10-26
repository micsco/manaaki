import { currentBuildSha } from "../pwa/appUpdate"

export const CLIENT_BUILD_HEADER = "x-manaaki-build"

export function withClientBuild(
  input: RequestInfo | URL,
  init?: RequestInit
): RequestInit | undefined {
  const build = currentBuildSha()
  if (!build) return init
  const headers = new Headers(
    init?.headers ?? (input instanceof Request ? input.headers : undefined)
  )
  headers.set(CLIENT_BUILD_HEADER, build)
  return { ...init, headers }
}

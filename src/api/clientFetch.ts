import { trackPendingWrite } from "../pwa/updateHolds"
import { withClientBuild } from "./clientBuild"
import { requestMethod, retryingFetch } from "./retryingFetch"

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"])

export function clientFetch(input: RequestInfo | URL, init?: RequestInit) {
  const send = () => retryingFetch(input, withClientBuild(input, init))
  return READ_METHODS.has(requestMethod(input, init)) ? send() : trackPendingWrite(send)
}

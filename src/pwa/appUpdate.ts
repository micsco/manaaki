export type UpdateTrigger =
  | "launch"
  | "navigation"
  | "hidden"
  | "resume"
  | "idle"
  | "manual"
  | "chunk-error"

export type UpdateSource = "worker-waiting" | "worker-activated" | "version-file"

export type WorkerActivation = "unsupported" | "none-waiting" | "activated" | "timeout" | "failed"

type AppliedUpdate = {
  trigger: UpdateTrigger
  source: UpdateSource | null
  heldMs: number
  fromSha: string | null
  activation: WorkerActivation
}

const PENDING_EVENT = "app-update-pending"
const APPLIED_KEY = "manaaki:update:applied"
const ATTEMPT_KEY = "manaaki:update:attempt"
const ACTIVATION_TIMEOUT_MS = 3000
export const LOOP_GUARD_MS = 5 * 60 * 1000

let pendingSince: number | null = null
let pendingSource: UpdateSource | null = null
let applying = false

export function currentBuildSha() {
  return (import.meta.env.VITE_BUILD_GIT_SHORT_SHA as string | undefined) || null
}

export function markUpdatePending(source: UpdateSource) {
  if (applying) return
  if (pendingSince === null) pendingSince = Date.now()
  pendingSource = source
  window.dispatchEvent(new Event(PENDING_EVENT))
}

export function onUpdatePending(listener: () => void) {
  window.addEventListener(PENDING_EVENT, listener)
  return () => window.removeEventListener(PENDING_EVENT, listener)
}

export function updatePendingSince() {
  return pendingSince
}

export function updatePendingSource() {
  return pendingSource
}

export function isApplyingAppUpdate() {
  return applying
}

function readJson(storage: Storage, key: string): unknown {
  try {
    const raw = storage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeJson(storage: Storage, key: string, value: unknown) {
  try {
    storage.setItem(key, JSON.stringify(value))
  } catch {}
}

export function recentlyAttemptedUpdate(now = Date.now()) {
  const attempt = readJson(sessionStorage, ATTEMPT_KEY) as { sha: string | null; at: number } | null
  return Boolean(attempt && attempt.sha === currentBuildSha() && now - attempt.at < LOOP_GUARD_MS)
}

export function takeAppliedUpdate():
  | (AppliedUpdate & { toSha: string | null; updated: boolean })
  | null {
  const applied = readJson(sessionStorage, APPLIED_KEY) as AppliedUpdate | null
  try {
    sessionStorage.removeItem(APPLIED_KEY)
  } catch {}
  if (!applied) return null
  const toSha = currentBuildSha()
  return { ...applied, toSha, updated: applied.fromSha !== toSha }
}

async function activateWaitingWorker(): Promise<WorkerActivation> {
  if (!("serviceWorker" in navigator)) return "unsupported"
  const registration = await navigator.serviceWorker.getRegistration()
  const waiting = registration?.waiting
  if (!waiting) return "none-waiting"
  return new Promise<WorkerActivation>(resolve => {
    const timeout = window.setTimeout(() => resolve("timeout"), ACTIVATION_TIMEOUT_MS)
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      () => {
        window.clearTimeout(timeout)
        resolve("activated")
      },
      { once: true }
    )
    // eslint-disable-next-line unicorn/require-post-message-target-origin -- ServiceWorker.postMessage has no targetOrigin argument
    waiting.postMessage({ type: "ACTIVATE_UPDATE" })
  })
}

export async function applyAppUpdate(
  trigger: UpdateTrigger,
  destination?: { href: string; replace?: boolean }
) {
  if (applying) return
  applying = true
  const now = Date.now()
  writeJson(sessionStorage, ATTEMPT_KEY, { sha: currentBuildSha(), at: now })
  const activation = await activateWaitingWorker().catch((): WorkerActivation => "failed")
  writeJson(sessionStorage, APPLIED_KEY, {
    trigger,
    source: pendingSource,
    heldMs: pendingSince === null ? 0 : now - pendingSince,
    fromSha: currentBuildSha(),
    activation,
  } satisfies AppliedUpdate)
  if (!destination) window.location.reload()
  else if (destination.replace) window.location.replace(destination.href)
  else window.location.assign(destination.href)
}

export function resetAppUpdateForTesting() {
  pendingSince = null
  pendingSource = null
  applying = false
}

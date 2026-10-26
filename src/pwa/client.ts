import { forgetAllDrafts } from "../hooks/usePersistentDraft"
import { isApplyingAppUpdate, markUpdatePending } from "./appUpdate"
import { receiveShoppingStatus } from "./shoppingSync"
import { setServerReachable } from "./useOnline"

const PRIVATE_PREFIXES = ["manaaki:cooking:", "manaaki:shopping:"]

export function clearCookingStorage() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (PRIVATE_PREFIXES.some(prefix => key.startsWith(prefix))) localStorage.removeItem(key)
    }
    window.dispatchEvent(new Event("cooking-storage"))
    window.dispatchEvent(new Event("shopping-sync"))
  } catch {}
  forgetAllDrafts()
}

const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000

export async function registerOfflineSupport(onFirstControl: () => void) {
  if (!("serviceWorker" in navigator)) return () => {}
  let pendingChecks = 0
  let controlled = !!navigator.serviceWorker.controller
  const sendSync = () => {
    const controller = navigator.serviceWorker.controller
    // eslint-disable-next-line unicorn/require-post-message-target-origin -- ServiceWorker.postMessage has no targetOrigin argument
    controller?.postMessage({ type: "SHOPPING_STATUS" })
    // eslint-disable-next-line unicorn/require-post-message-target-origin -- ServiceWorker.postMessage has no targetOrigin argument
    controller?.postMessage({ type: "SYNC_SHOPPING" })
  }
  const onController = () => {
    sendSync()
    if (!controlled) onFirstControl()
    else if (!isApplyingAppUpdate()) markUpdatePending("worker-activated")
    controlled = true
  }
  const onMessage = (event: MessageEvent) => {
    if (event.data?.type === "OFFLINE_FALLBACK") setServerReachable(false)
    if (event.data?.type === "SERVER_REACHABLE") setServerReachable(true)
    if (event.data?.type === "SHOPPING_SYNC") {
      pendingChecks = event.data.pending
      receiveShoppingStatus(event.data.pending, event.data.blocked)
    }
    if (event.data?.type === "RECIPE_UPDATED") window.dispatchEvent(new Event("recipe-updated"))
    if (event.data?.type === "ACCOUNT_CHANGED") {
      clearCookingStorage()
      receiveShoppingStatus(0)
    }
  }
  navigator.serviceWorker.addEventListener("controllerchange", onController)
  navigator.serviceWorker.addEventListener("message", onMessage)
  const registration = await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" })
  const offerUpdate = () => {
    if (registration.active && registration.waiting) markUpdatePending("worker-waiting")
  }
  const onInstalled = () => offerUpdate()
  const onUpdate = () => registration.installing?.addEventListener("statechange", onInstalled)
  registration.addEventListener("updatefound", onUpdate)
  offerUpdate()
  sendSync()
  const retry = window.setInterval(() => {
    if (pendingChecks > 0 && navigator.onLine) sendSync()
  }, 30_000)
  window.addEventListener("online", sendSync)
  const updateCheck = window.setInterval(() => {
    if (document.visibilityState === "visible") void registration.update().catch(() => {})
  }, UPDATE_CHECK_INTERVAL_MS)
  const check = () => {
    if (document.visibilityState === "visible") {
      sendSync()
      void registration.update().catch(() => {})
    }
  }
  document.addEventListener("visibilitychange", check)
  void navigator.storage?.persist?.().catch(() => {})
  return () => {
    navigator.serviceWorker.removeEventListener("controllerchange", onController)
    navigator.serviceWorker.removeEventListener("message", onMessage)
    registration.removeEventListener("updatefound", onUpdate)
    window.clearInterval(retry)
    window.clearInterval(updateCheck)
    window.removeEventListener("online", sendSync)
    document.removeEventListener("visibilitychange", check)
  }
}

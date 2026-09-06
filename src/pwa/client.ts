import { receiveShoppingStatus } from "./shoppingSync"
import { setServerReachable } from "./useOnline"

export function clearCookingStorage() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("manaaki:cooking:") || key.startsWith("manaaki:shopping:"))
        localStorage.removeItem(key)
    }
    window.dispatchEvent(new Event("cooking-storage"))
    window.dispatchEvent(new Event("shopping-sync"))
  } catch {}
}

export async function applyAppUpdate() {
  if (!("serviceWorker" in navigator)) {
    window.location.reload()
    return
  }
  const registration = await navigator.serviceWorker.getRegistration()
  if (!registration?.waiting) {
    window.location.reload()
    return
  }
  navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload(), {
    once: true,
  })
  // eslint-disable-next-line unicorn/require-post-message-target-origin -- ServiceWorker.postMessage has no targetOrigin argument
  registration.waiting.postMessage({ type: "ACTIVATE_UPDATE" })
}

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
    controlled = true
  }
  const onMessage = (event: MessageEvent) => {
    if (event.data?.type === "OFFLINE_FALLBACK") setServerReachable(false)
    if (event.data?.type === "SERVER_REACHABLE") setServerReachable(true)
    if (event.data?.type === "SHOPPING_SYNC") {
      pendingChecks = event.data.pending
      receiveShoppingStatus(event.data.pending, event.data.blocked)
    }
    if (event.data?.type === "ACCOUNT_CHANGED") {
      clearCookingStorage()
      receiveShoppingStatus(0)
    }
  }
  navigator.serviceWorker.addEventListener("controllerchange", onController)
  navigator.serviceWorker.addEventListener("message", onMessage)
  const registration = await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" })
  const offerUpdate = () => {
    if (registration.active && registration.waiting)
      window.dispatchEvent(new Event("pwa-update-ready"))
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
    window.removeEventListener("online", sendSync)
    document.removeEventListener("visibilitychange", check)
  }
}

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
  let controlled = !!navigator.serviceWorker.controller
  const onController = () => {
    if (!controlled) onFirstControl()
    controlled = true
  }
  const onMessage = (event: MessageEvent) => {
    if (event.data?.type === "OFFLINE_FALLBACK") setServerReachable(false)
    if (event.data?.type === "SERVER_REACHABLE") setServerReachable(true)
    if (event.data?.type === "ACCOUNT_CHANGED") clearCookingStorage()
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
  const check = () => {
    if (document.visibilityState === "visible") void registration.update().catch(() => {})
  }
  document.addEventListener("visibilitychange", check)
  void navigator.storage?.persist?.().catch(() => {})
  return () => {
    navigator.serviceWorker.removeEventListener("controllerchange", onController)
    navigator.serviceWorker.removeEventListener("message", onMessage)
    registration.removeEventListener("updatefound", onUpdate)
    document.removeEventListener("visibilitychange", check)
  }
}

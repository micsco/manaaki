import { useSyncExternalStore } from "react"

interface InstallEvent extends Event {
  prompt(): Promise<unknown>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

let promptEvent: InstallEvent | null = null
let installed = false
const listeners = new Set<() => void>()
const notify = () => {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function trackInstallation() {
  const beforeInstall = (event: Event) => {
    event.preventDefault()
    promptEvent = event as InstallEvent
    notify()
  }
  const onInstalled = () => {
    installed = true
    promptEvent = null
    notify()
  }
  window.addEventListener("beforeinstallprompt", beforeInstall)
  window.addEventListener("appinstalled", onInstalled)
  const media = window.matchMedia?.("(display-mode: standalone)")
  media?.addEventListener("change", notify)
  return () => {
    window.removeEventListener("beforeinstallprompt", beforeInstall)
    window.removeEventListener("appinstalled", onInstalled)
    media?.removeEventListener("change", notify)
  }
}

export function useInstallation() {
  const standalone = useSyncExternalStore(
    subscribe,
    () =>
      installed ||
      window.matchMedia?.("(display-mode: standalone)").matches ||
      !!(navigator as Navigator & { standalone?: boolean }).standalone,
    () => true
  )
  const available = useSyncExternalStore(
    subscribe,
    () => !!promptEvent,
    () => false
  )
  const ios = useSyncExternalStore(
    subscribe,
    () =>
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1),
    () => false
  )
  async function install() {
    const event = promptEvent
    if (!event) return
    promptEvent = null
    notify()
    try {
      await event.prompt()
      if ((await event.userChoice).outcome === "accepted") {
        installed = true
        notify()
      }
    } catch {}
  }
  return { standalone, available, ios, install }
}

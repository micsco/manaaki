import { useSyncExternalStore } from "react"

let reachable = true
export function setServerReachable(value: boolean) {
  reachable = value
  window.dispatchEvent(new Event("server-connectivity"))
}

function subscribe(listener: () => void) {
  window.addEventListener("server-connectivity", listener)
  window.addEventListener("online", listener)
  window.addEventListener("offline", listener)
  return () => {
    window.removeEventListener("server-connectivity", listener)
    window.removeEventListener("online", listener)
    window.removeEventListener("offline", listener)
  }
}

export function useOnline() {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine && reachable,
    () => true
  )
}

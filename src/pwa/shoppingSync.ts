import { useSyncExternalStore } from "react"

let status = { pending: 0, blocked: false }
const listeners = new Set<() => void>()

export function receiveShoppingStatus(pending: number, blocked = false) {
  if (status.pending === pending && status.blocked === blocked) return
  const completed = status.pending > 0 && pending === 0
  status = { pending, blocked }
  for (const listener of listeners) listener()
  if (completed) window.dispatchEvent(new Event("shopping-synced"))
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const initialStatus = { pending: 0, blocked: false }

export function useShoppingSync() {
  return useSyncExternalStore(
    subscribe,
    () => status,
    () => initialStatus
  )
}

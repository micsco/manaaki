import { useEffect } from "react"

export const TYPING_GRACE_MS = 90 * 1000

export type UpdateContext = "in-place" | "navigation"
type HoldScope = "always" | UpdateContext

const holds = new Map<symbol, { reason: string; scope: HoldScope }>()
let pendingWrites = 0
let lastTypedAt = 0

export function holdAppUpdate(reason: string, scope: HoldScope = "always") {
  const id = Symbol(reason)
  holds.set(id, { reason, scope })
  return () => {
    holds.delete(id)
  }
}

export function useHoldAppUpdate(active: boolean, reason: string, scope: HoldScope = "always") {
  useEffect(() => {
    if (!active) return
    return holdAppUpdate(reason, scope)
  }, [active, reason, scope])
}

export async function trackPendingWrite<T>(write: () => Promise<T>): Promise<T> {
  pendingWrites++
  try {
    return await write()
  } finally {
    pendingWrites--
  }
}

export function pendingWriteCount() {
  return pendingWrites
}

function isEditable(element: Element | null): element is HTMLElement {
  if (!(element instanceof HTMLElement)) return false
  if (element.isContentEditable) return true
  if (element instanceof HTMLTextAreaElement) return true
  return (
    element instanceof HTMLInputElement &&
    !["button", "checkbox", "radio", "range", "submit", "reset", "color", "file"].includes(
      element.type
    )
  )
}

function hasTypedText(element: HTMLElement) {
  if (element.isContentEditable) return Boolean(element.textContent?.trim())
  return Boolean((element as HTMLInputElement | HTMLTextAreaElement).value.trim())
}

export function noteTyping(event: Event) {
  if (isEditable(event.target as Element | null)) lastTypedAt = Date.now()
}

function openUnsafeDialog() {
  return Array.from(
    document.querySelectorAll<HTMLElement>('[role="dialog"], [role="alertdialog"]')
  ).some(dialog => !dialog.closest("[data-update-safe]") && !dialog.hidden)
}

export function updateBlockers(context: UpdateContext, now = Date.now()): string[] {
  const reasons = [
    ...new Set(
      [...holds.values()]
        .filter(hold => hold.scope === "always" || hold.scope === context)
        .map(hold => hold.reason)
    ),
  ]
  if (pendingWrites > 0) reasons.push("saving")
  const focused = document.activeElement
  if (isEditable(focused) && hasTypedText(focused) && now - lastTypedAt < TYPING_GRACE_MS)
    reasons.push("typing")
  if (context === "in-place" && openUnsafeDialog()) reasons.push("dialog")
  return reasons
}

export function resetUpdateHoldsForTesting() {
  holds.clear()
  pendingWrites = 0
  lastTypedAt = 0
}

import { useShoppingSync } from "../pwa/shoppingSync"

export function ShoppingSyncStatus() {
  const { pending, blocked } = useShoppingSync()
  if (!pending) return null
  return (
    <p role="status" className="mx-auto max-w-2xl px-4 py-2 text-sm text-amber-300">
      {blocked
        ? "Your checks are saved on this device. Sign in again to sync them."
        : `${pending} ${pending === 1 ? "change" : "changes"} saved on this device. Syncs automatically when connected.`}
    </p>
  )
}

import { useOnline } from "../pwa/useOnline"

export function OfflineStatus() {
  const online = useOnline()
  if (online) return null
  return (
    <div
      role="status"
      className="border-b border-amber-900 bg-amber-950 px-4 py-2 text-center text-sm text-amber-200"
    >
      You’re offline. Previously opened recipes and lists are available.
    </div>
  )
}

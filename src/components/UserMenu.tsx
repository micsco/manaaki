import { useCurrentUser } from "../hooks/useCurrentUser"

export function UserMenu() {
  const current = useCurrentUser()
  if (!current) return null

  if (current.isAnonymous) {
    return (
      <a
        href="/api/auth/oauth"
        className="rounded-lg bg-orange-600 px-3 py-1.5 font-medium text-sm text-white transition-colors hover:bg-orange-500"
      >
        Sign in
      </a>
    )
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" })
    window.location.assign("/recipes")
  }

  return (
    <div className="flex items-center gap-2">
      <a
        href="/plan"
        className="rounded-lg bg-gray-800 px-3 py-1.5 font-medium text-gray-200 text-sm transition-colors hover:bg-gray-700"
      >
        Meal Plan
      </a>
      <button
        type="button"
        onClick={signOut}
        className="rounded-lg px-3 py-1.5 font-medium text-gray-400 text-sm transition-colors hover:text-gray-200"
      >
        Sign out
      </button>
    </div>
  )
}

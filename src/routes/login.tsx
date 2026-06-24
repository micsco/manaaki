import { createFileRoute, redirect } from "@tanstack/react-router"

type LoginSearch = { code?: string; state?: string; error?: string }

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    code: typeof search.code === "string" ? search.code : undefined,
    state: typeof search.state === "string" ? search.state : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  beforeLoad: ({ search }) => {
    if (search.code && search.state) {
      throw redirect({
        href: `/api/auth/complete?code=${encodeURIComponent(search.code)}&state=${encodeURIComponent(search.state)}`,
      })
    }
  },
  component: LoginPage,
})

export function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gray-950 px-6 text-center text-gray-100">
      <h1 className="font-bold text-3xl">Sign in to Manaaki</h1>
      <p className="max-w-sm text-gray-400">
        Browsing recipes is open to everyone. Sign in to use your meal planner and household
        features.
      </p>
      <a
        href="/api/auth/oauth"
        className="rounded-lg bg-orange-600 px-5 py-2.5 font-medium text-white transition-colors hover:bg-orange-500"
      >
        Sign in with Google
      </a>
    </main>
  )
}

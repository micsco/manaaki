import { createFileRoute, redirect } from "@tanstack/react-router"

import { loginCompletionHref, type LoginReturnSearch } from "../utils/loginReturn"

type LoginSearch = LoginReturnSearch

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    code: typeof search.code === "string" ? search.code : undefined,
    state: typeof search.state === "string" ? search.state : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  beforeLoad: ({ search }) => {
    const href = loginCompletionHref(search)
    if (href) throw redirect({ href })
  },
  component: LoginRoute,
})

function LoginRoute() {
  const { error } = Route.useSearch()
  return <LoginPage failed={error !== undefined} />
}

export function LoginPage({ failed = false }: Readonly<{ failed?: boolean }>) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gray-950 px-6 text-center text-gray-100">
      <h1 className="text-3xl font-bold">Sign in to Manaaki</h1>
      {failed && (
        <p role="alert" className="max-w-sm text-amber-400">
          Signing in didn't work. Try again, and if it keeps failing, check that you are using your
          household's Google account.
        </p>
      )}
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

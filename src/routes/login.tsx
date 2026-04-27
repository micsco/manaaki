import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { handleOauthCallback, oauthRedirect, login, isAuthenticated } from '../api/auth'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

type PageState =
  | { status: 'idle' }
  | { status: 'completing-oauth' }
  | { status: 'error'; message: string }

function LoginPage() {
  const navigate = useNavigate()
  const [state, setState] = useState<PageState>({ status: 'idle' })

  // On mount, check whether we're landing here as the OAuth redirect target.
  // Mealie sends the browser back to /login?code=...&state=... after the IdP
  // authenticates the user. We detect those params and exchange them for a
  // Mealie bearer token.
  useEffect(() => {
    if (isAuthenticated()) {
      navigate({ to: '/' })
      return
    }

    const searchParams = new URLSearchParams(window.location.search)
    if (!searchParams.has('code') || !searchParams.has('state')) return

    setState({ status: 'completing-oauth' })

    handleOauthCallback(searchParams)
      .then((user) => {
        if (user) {
          // Strip the OAuth params from the URL before navigating away
          window.history.replaceState({}, '', '/login')
          navigate({ to: '/' })
        }
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'OAuth login failed'
        setState({ status: 'error', message })
      })
  }, [navigate])

  // --- Username / password form state ---
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [formLoading, setFormLoading] = useState(false)

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault()
    setFormLoading(true)
    try {
      await login(username, password)
      navigate({ to: '/' })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed'
      setState({ status: 'error', message })
    } finally {
      setFormLoading(false)
    }
  }

  // --- Render ---

  if (state.status === 'completing-oauth') {
    return <p>Completing sign-in…</p>
  }

  return (
    <main>
      <h1>Sign in</h1>

      {state.status === 'error' && (
        <p role="alert">{state.message}</p>
      )}

      <form onSubmit={handlePasswordLogin}>
        <div>
          <label htmlFor="username">Username</label>
          <input
            id="username"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit" disabled={formLoading}>
          {formLoading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <hr />

      <button type="button" onClick={oauthRedirect}>
        Sign in with OAuth
      </button>
    </main>
  )
}

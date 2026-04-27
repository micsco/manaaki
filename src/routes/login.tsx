import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"
import { isAuthenticated } from "../api/auth"

export const Route = createFileRoute("/login")({
  component: LoginPage,
})

function LoginPage() {
  const navigate = useNavigate()

  useEffect(() => {
    if (isAuthenticated()) {
      navigate({ to: "/" })
    }
  }, [navigate])

  return (
    <main>
      <h1>Not configured</h1>
      <p>
        No API token found. Set <code>VITE_MEALIE_API_TOKEN</code> in your <code>.env</code> file
        and restart the dev server.
      </p>
      <p>
        You can generate a token from your Mealie profile under{" "}
        <strong>Settings → API Tokens</strong>.
      </p>
    </main>
  )
}

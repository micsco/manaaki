import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/login")({
  component: LoginPage,
})

function LoginPage() {
  return (
    <main>
      <h1>Unable to connect</h1>
      <p>The app could not reach the Mealie API. This usually means the server is misconfigured.</p>
      <p>
        Check that <code>MEALIE_API_TOKEN</code> and <code>MEALIE_INTERNAL_URL</code> are set
        correctly in the deployment environment, then redeploy.
      </p>
    </main>
  )
}

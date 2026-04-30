import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/login")({
  component: LoginPage,
})

/**
 * Shown when the Mealie API proxy is unreachable or the server-side token is
 * invalid. Previously this page guided users to set VITE_MEALIE_API_TOKEN;
 * now the token is held entirely on the server and never sent to the browser.
 *
 * If you see this page in production, check the deployment environment for:
 *   MEALIE_API_TOKEN     — long-lived Mealie API token
 *   MEALIE_INTERNAL_URL  — internal Docker URL for Mealie
 */
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

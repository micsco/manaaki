import { createFileRoute } from '@tanstack/react-router'
import { getCurrentUser } from '../api/auth'

export const Route = createFileRoute('/')({
  loader: getCurrentUser,
  component: Home,
})

function Home() {
  const user = Route.useLoaderData()

  return (
    <main>
      <h1>What's Cookin'?</h1>
      <p>
        Signed in as <strong>{user.fullName ?? user.username}</strong> ({user.email})
      </p>
    </main>
  )
}

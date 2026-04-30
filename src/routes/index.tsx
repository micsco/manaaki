import { createFileRoute, Link } from "@tanstack/react-router"
import { ChevronRight } from "lucide-react"
import { getCurrentUser } from "../api/auth"
import { CookModeToggle } from "../components/CookModeToggle"
import { Button } from "../components/ui"

export const Route = createFileRoute("/")({
  loader: getCurrentUser,
  component: Home,
})

function Home() {
  const user = Route.useLoaderData()

  return (
    <main className="min-h-screen bg-gray-950">
      <div className="mx-auto max-w-4xl px-4 py-16">
        <div className="animate-fade-in text-center">
          <h1 className="mb-8 bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text font-bold text-5xl text-gray-100 text-transparent">
            What's Cookin'?
          </h1>

          <div className="mb-8 inline-block rounded-lg bg-gray-900 p-6">
            <p className="mb-4 text-gray-300 text-lg">
              Signed in as{" "}
              <span className="font-semibold text-orange-400">
                {user.fullName ?? user.username}
              </span>{" "}
              <span className="text-gray-500">({user.email})</span>
            </p>

            <div className="flex items-center justify-center">
              <CookModeToggle />
            </div>
          </div>

          <div className="animate-slide-up">
            <Button asChild size="lg" className="gap-2">
              <Link to="/recipes">
                Browse recipes
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </main>
  )
}

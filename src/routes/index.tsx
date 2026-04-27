import { createFileRoute, Link } from "@tanstack/react-router"
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
      <div className="max-w-4xl mx-auto px-4 py-16">
        <div className="text-center animate-fade-in">
          <h1 className="text-5xl font-bold text-gray-100 mb-8 bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">
            What's Cookin'?
          </h1>

          <div className="bg-gray-900 rounded-lg p-6 mb-8 inline-block">
            <p className="text-lg text-gray-300 mb-4">
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
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </main>
  )
}

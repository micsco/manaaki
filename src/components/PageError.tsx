import { Link, useRouter } from "@tanstack/react-router"

import { useOnline } from "../pwa/useOnline"

export function PageError() {
  const router = useRouter()
  const online = useOnline()
  return (
    <main className="mx-auto max-w-lg px-6 py-12">
      <h1 className="mb-3 text-2xl font-semibold">
        {online ? "This page couldn’t load" : "This page isn’t available offline yet"}
      </h1>
      <p className="mb-6 text-gray-300">
        {online
          ? "Try again in a moment."
          : "Recipes are saved automatically when you open them or view your meal plan. Try a recipe you’ve used before."}
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => {
            void router.invalidate()
          }}
          className="min-h-11 rounded-lg bg-orange-600 px-4 py-2 font-medium text-white"
        >
          Try again
        </button>
        <Link
          to="/recipes"
          className="inline-flex min-h-11 items-center rounded-lg bg-gray-800 px-4 py-2 text-gray-100"
        >
          Back to recipes
        </Link>
      </div>
    </main>
  )
}

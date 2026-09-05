import { createFileRoute, redirect } from "@tanstack/react-router"

import { fetchCurrentUser } from "../api/auth"

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const current = await fetchCurrentUser()
    throw redirect({ to: current.isAnonymous ? "/recipes" : "/plan" })
  },
})

import { createFileRoute, redirect } from "@tanstack/react-router"

import { fetchCurrentUser } from "../api/auth"
import { WeeklyMealPlan } from "../components/WeeklyMealPlan"

export const Route = createFileRoute("/plan")({
  head: () => ({ meta: [{ title: "Meal Plan · Manaaki" }] }),
  beforeLoad: async () => {
    const { isAnonymous } = await fetchCurrentUser()
    if (isAnonymous) throw redirect({ href: "/api/auth/oauth" })
  },
  component: WeeklyMealPlan,
})

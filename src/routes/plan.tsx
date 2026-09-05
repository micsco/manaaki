import { createFileRoute, redirect } from "@tanstack/react-router"

import { fetchCurrentUser } from "../api/auth"
import { WeeklyMealPlan } from "../components/WeeklyMealPlan"
import { loginStartHref } from "../utils/loginReturn"

export const Route = createFileRoute("/plan")({
  head: () => ({ meta: [{ title: "Meal Plan · Manaaki" }] }),
  beforeLoad: async () => {
    const { isAnonymous } = await fetchCurrentUser()
    if (isAnonymous) throw redirect({ href: loginStartHref("/plan") })
  },
  component: WeeklyMealPlan,
})

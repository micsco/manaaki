import { useLocation } from "@tanstack/react-router"
import { createContext, useContext, useEffect, type ReactNode } from "react"

import { useSessionStorage } from "../hooks/useSessionStorage"
import { navigationDestination } from "../utils/navigation"

const NavigationContext = createContext({ plan: "/plan", recipes: "/recipes", origin: "/recipes" })

export function NavigationProvider({ children }: { children: ReactNode }) {
  const location = useLocation()
  const [plan, setPlan] = useSessionStorage("navigation-plan", "/plan")
  const [recipes, setRecipes] = useSessionStorage("navigation-recipes", "/recipes")
  const [origin, setOrigin] = useSessionStorage("navigation-origin", "/recipes")

  useEffect(() => {
    const pathname = location.pathname.replace(/\/$/, "")
    const href = pathname + location.searchStr
    if (pathname === "/plan") setPlan(href)
    if (pathname === "/recipes") setRecipes(href)
    if (["/plan", "/recipes", "/shopping"].includes(pathname)) setOrigin(href)
  }, [location.pathname, location.searchStr, setPlan, setRecipes, setOrigin])

  return (
    <NavigationContext.Provider value={{ plan, recipes, origin }}>
      {children}
    </NavigationContext.Provider>
  )
}

export function useNavigationDestinations() {
  const locations = useContext(NavigationContext)
  return {
    plan: navigationDestination(locations.plan),
    recipes: navigationDestination(locations.recipes),
    origin: navigationDestination(locations.origin),
  }
}

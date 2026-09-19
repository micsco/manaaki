import { mdiRefresh } from "@mdi/js"
import { useQueryClient } from "@tanstack/react-query"
import { useRef, useState } from "react"

import { toastManager } from "../lib/toastManager"
import { Icon } from "./Icon"
import { Button } from "./ui/Button"

export function RefreshButton() {
  const queryClient = useQueryClient()
  const pending = useRef(false)
  const [refreshing, setRefreshing] = useState(false)

  async function refresh() {
    if (pending.current) return
    if (!navigator.onLine) {
      toastManager.add({ title: "You’re offline", description: "Reconnect to refresh your data." })
      return
    }
    pending.current = true
    setRefreshing(true)
    try {
      await queryClient.invalidateQueries(
        {
          predicate: query =>
            ["mealplan", "shopping", "recipes"].includes(String(query.queryKey[0])),
        },
        { throwOnError: true, cancelRefetch: false }
      )
    } catch {
      toastManager.add({
        title: "Couldn’t refresh",
        description: "Please check your connection and try again.",
      })
    } finally {
      pending.current = false
      setRefreshing(false)
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label={refreshing ? "Refreshing data" : "Refresh data"}
      aria-busy={refreshing}
      disabled={refreshing}
      onClick={() => void refresh()}
      title="Refresh data"
      className="gap-1.5"
    >
      <Icon
        path={mdiRefresh}
        size={0.85}
        aria-hidden
        className={refreshing ? "motion-safe:animate-spin" : undefined}
      />
      <span className="text-xs">Refresh</span>
    </Button>
  )
}

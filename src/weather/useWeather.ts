import { useQuery } from "@tanstack/react-query"
import { useSyncExternalStore } from "react"

import { loadWeather, weatherMaxAge, weatherCacheTtl } from "./forecast"

function subscribeClock(onChange: () => void) {
  const interval = setInterval(onChange, 60000)
  return () => clearInterval(interval)
}
const currentMinute = () => Math.floor(Date.now() / 60000) * 60000
const serverMinute = () => 0

export function useWeather() {
  const now = useSyncExternalStore(subscribeClock, currentMinute, serverMinute)
  const query = useQuery({
    queryKey: ["weather", "lewisham-v2"],
    queryFn: loadWeather,
    enabled: now !== 0,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    retry: false,
  })
  const snapshot = query.data && now - query.data.fetchedAt < weatherMaxAge ? query.data : undefined
  return {
    snapshot,
    isStale: Boolean(snapshot && now - snapshot.fetchedAt >= weatherCacheTtl),
    isPending: query.isPending,
    isFetching: query.isFetching,
    refresh: () => {
      void query.refetch()
    },
  }
}

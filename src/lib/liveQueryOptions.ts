export const liveQueryOptions = {
  staleTime: 30_000,
  refetchInterval: () => (typeof navigator === "undefined" || navigator.onLine ? 60_000 : false),
  refetchIntervalInBackground: false,
  refetchOnWindowFocus: true,
  refetchOnReconnect: "always",
} as const

export const recipeListRefreshOptions = {
  ...liveQueryOptions,
  staleTime: 30 * 60_000,
  refetchOnWindowFocus: "always",
  refetchInterval: () =>
    typeof navigator === "undefined" || navigator.onLine ? 30 * 60_000 : false,
} as const

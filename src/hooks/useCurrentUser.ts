import { queryOptions, useQuery } from "@tanstack/react-query"
import { type CurrentUser, fetchCurrentUser } from "../api/auth"

export const currentUserQueryOptions = queryOptions({
  queryKey: ["currentUser"],
  queryFn: fetchCurrentUser,
  staleTime: 5 * 60 * 1000,
})

export function useCurrentUser(): CurrentUser | undefined {
  const { data } = useQuery(currentUserQueryOptions)
  return data
}

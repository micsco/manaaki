import { queryOptions, useQuery } from "@tanstack/react-query"
import { getCurrentUser } from "../api/auth"

export const groupSlugQueryOptions = queryOptions({
  queryKey: ["groupSlug"],
  queryFn: async () => {
    const user = await getCurrentUser()
    return user.groupSlug
  },
  staleTime: Number.POSITIVE_INFINITY,
})

export function useGroupSlug(): string | undefined {
  const { data } = useQuery(groupSlugQueryOptions)
  return data
}

import { useCurrentUser } from "./useCurrentUser"

export function useGroupSlug(): string | undefined {
  const current = useCurrentUser()
  return current?.user?.groupSlug ?? undefined
}

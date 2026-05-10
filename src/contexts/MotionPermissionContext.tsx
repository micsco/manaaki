import { createContext, type ReactNode, useContext } from "react"
import { type MotionPermissionState, useMotionPermission } from "../hooks/useMotionPermission"

interface MotionPermissionContextType {
  state: MotionPermissionState
  request: () => Promise<void>
}

const MotionPermissionContext = createContext<MotionPermissionContextType | undefined>(undefined)

export function useMotionPermissionContext() {
  const context = useContext(MotionPermissionContext)
  if (context === undefined) {
    throw new Error("useMotionPermissionContext must be used within a MotionPermissionProvider")
  }
  return context
}

export function MotionPermissionProvider({ children }: { children: ReactNode }) {
  const { state, request } = useMotionPermission()

  return (
    <MotionPermissionContext.Provider value={{ state, request }}>
      {children}
    </MotionPermissionContext.Provider>
  )
}

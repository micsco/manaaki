import { parseAsBoolean, useQueryState } from "nuqs"
import { createContext, type ReactNode, useCallback, useContext, useEffect } from "react"

interface CookModeContextType {
  isCookMode: boolean
  toggleCookMode: () => void
}

const CookModeContext = createContext<CookModeContextType | undefined>(undefined)

export function useCookMode() {
  const context = useContext(CookModeContext)
  if (context === undefined) {
    throw new Error("useCookMode must be used within a CookModeProvider")
  }
  return context
}

interface CookModeProviderProps {
  children: ReactNode
}

export function CookModeProvider({ children }: CookModeProviderProps) {
  const [isCookMode, setIsCookMode] = useQueryState("cook", parseAsBoolean.withDefault(false))

  const toggleCookMode = useCallback(() => {
    void setIsCookMode(prev => !prev)
  }, [setIsCookMode])

  useEffect(() => {
    let wakeLock: WakeLockSentinel | null = null
    let cancelled = false

    if (isCookMode && "wakeLock" in navigator) {
      navigator.wakeLock
        .request("screen")
        .then(lock => {
          if (cancelled) return lock.release()
          wakeLock = lock
        })
        .catch(() => {})
    }

    return () => {
      cancelled = true
      if (wakeLock) {
        void wakeLock.release().catch(() => {})
      }
    }
  }, [isCookMode])

  return (
    <CookModeContext.Provider value={{ isCookMode, toggleCookMode }}>
      {children}
    </CookModeContext.Provider>
  )
}

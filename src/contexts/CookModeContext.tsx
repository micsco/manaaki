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

    let requesting = false
    const acquire = async () => {
      if (
        !isCookMode ||
        !("wakeLock" in navigator) ||
        document.visibilityState === "hidden" ||
        requesting ||
        (wakeLock && !wakeLock.released)
      )
        return
      requesting = true
      try {
        const lock = await navigator.wakeLock.request("screen")
        if (cancelled) await lock.release()
        else wakeLock = lock
      } catch {
      } finally {
        requesting = false
      }
    }
    void acquire()
    document.addEventListener("visibilitychange", acquire)
    return () => {
      cancelled = true
      document.removeEventListener("visibilitychange", acquire)
      if (wakeLock) void wakeLock.release().catch(() => {})
    }
  }, [isCookMode])

  return (
    <CookModeContext.Provider value={{ isCookMode, toggleCookMode }}>
      {children}
    </CookModeContext.Provider>
  )
}

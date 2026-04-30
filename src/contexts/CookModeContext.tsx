import { useQueryState } from "nuqs"
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
  const [isCookMode, setIsCookMode] = useQueryState("cook", {
    parse: (value: string) => value === "true",
    serialize: (value: boolean) => value.toString(),
    defaultValue: false,
    clearOnDefault: true,
  })

  const toggleCookMode = useCallback(() => {
    setIsCookMode(prev => !prev)
  }, [setIsCookMode])

  // Prevent screen timeout in cook mode
  useEffect(() => {
    let wakeLock: WakeLockSentinel | null = null

    if (isCookMode && "wakeLock" in navigator) {
      navigator.wakeLock
        .request("screen")
        .then(lock => {
          wakeLock = lock
        })
        .catch(() => {
          // Wake lock not supported or denied
        })
    }

    return () => {
      if (wakeLock) {
        wakeLock.release()
      }
    }
  }, [isCookMode])

  return (
    <CookModeContext.Provider value={{ isCookMode, toggleCookMode }}>
      {children}
    </CookModeContext.Provider>
  )
}

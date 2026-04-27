import { useQueryState } from "nuqs"
import { createContext, type ReactNode, useContext, useEffect } from "react"

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
    // Parse URL param to boolean
    parse: (value: string) => value === "true",
    // Serialize boolean to URL param
    serialize: (value: boolean) => value.toString(),
    // Default to false if not present
    defaultValue: false,
    // Clear the param when false to keep URLs clean
    clearOnDefault: true,
  })

  const toggleCookMode = () => {
    setIsCookMode(prev => !prev)
  }

  // Add keyboard shortcut (Ctrl/Cmd + K) for cook mode
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault()
        toggleCookMode()
      }
    }

    window.addEventListener("keydown", handleKeyPress)
    return () => window.removeEventListener("keydown", handleKeyPress)
  }, [toggleCookMode])

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

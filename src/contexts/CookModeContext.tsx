import { createContext, type ReactNode, useContext, useEffect, useState } from "react"

interface CookModeContextType {
  isCookMode: boolean
  toggleCookMode: () => void
  setCookMode: (enabled: boolean) => void
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
  const [isCookMode, setIsCookMode] = useState(() => {
    // Check localStorage for saved preference
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("cookMode")
      return saved === "true"
    }
    return false
  })

  const toggleCookMode = () => {
    setIsCookMode(prev => !prev)
  }

  const setCookMode = (enabled: boolean) => {
    setIsCookMode(enabled)
  }

  // Save preference to localStorage
  useEffect(() => {
    localStorage.setItem("cookMode", isCookMode.toString())
  }, [isCookMode])

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
  }, [])

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
    <CookModeContext.Provider value={{ isCookMode, toggleCookMode, setCookMode }}>
      {children}
    </CookModeContext.Provider>
  )
}

import { useCallback, useEffect, useState } from "react"

function readFromStorage<T>(key: string, initialValue: T): T {
  if (typeof window === "undefined") return initialValue
  try {
    const item = window.sessionStorage.getItem(key)
    return item ? (JSON.parse(item) as T) : initialValue
  } catch (error) {
    console.warn(`Error reading sessionStorage key "${key}":`, error)
    return initialValue
  }
}

export function useSessionStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(initialValue)

  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        setStoredValue(prev => {
          const next = value instanceof Function ? value(prev) : value
          if (typeof window !== "undefined") {
            window.sessionStorage.setItem(key, JSON.stringify(next))
            window.dispatchEvent(new CustomEvent("session-storage", { detail: { key } }))
          }
          return next
        })
      } catch (error) {
        console.warn(`Error setting sessionStorage key "${key}":`, error)
      }
    },
    [key]
  )

  useEffect(() => {
    setStoredValue(readFromStorage(key, initialValue))

    const onSessionStorage = (e: Event) => {
      if ((e as CustomEvent<{ key: string }>).detail.key === key) {
        setStoredValue(readFromStorage(key, initialValue))
      }
    }
    window.addEventListener("session-storage", onSessionStorage)
    return () => window.removeEventListener("session-storage", onSessionStorage)
  }, [key, initialValue])

  return [storedValue, setValue] as const
}

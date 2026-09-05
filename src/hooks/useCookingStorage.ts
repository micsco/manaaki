import { useCallback, useMemo, useSyncExternalStore } from "react"

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(`manaaki:cooking:v1:${key}`)
  } catch {
    return null
  }
}

function parseStorage<T>(raw: string | null, initialValue: T): T {
  if (raw === null) return initialValue
  try {
    return JSON.parse(raw) as T
  } catch {
    return initialValue
  }
}

function subscribe(listener: () => void) {
  window.addEventListener("cooking-storage", listener)
  window.addEventListener("storage", listener)
  return () => {
    window.removeEventListener("cooking-storage", listener)
    window.removeEventListener("storage", listener)
  }
}

function writeStorage(key: string, value: unknown) {
  try {
    window.localStorage.setItem(`manaaki:cooking:v1:${key}`, JSON.stringify(value))
    window.dispatchEvent(new CustomEvent("cooking-storage", { detail: { key } }))
  } catch (error) {
    console.warn(`Error setting localStorage key "${key}":`, error)
  }
}

export function useCookingStorage<T>(key: string, initialValue: T) {
  const raw = useSyncExternalStore(
    subscribe,
    () => readStorage(key),
    () => null
  )
  const storedValue = useMemo(() => parseStorage(raw, initialValue), [raw, initialValue])
  const setValue = useCallback(
    (value: T | ((previous: T) => T)) => {
      const previous = parseStorage(readStorage(key), initialValue)
      writeStorage(key, value instanceof Function ? value(previous) : value)
    },
    [key, initialValue]
  )
  return [storedValue, setValue] as const
}

export function useCookingStorageGroup(keys: string[]) {
  const allChecked = useSyncExternalStore(
    subscribe,
    () => keys.length > 0 && keys.every(key => readStorage(key) === "true"),
    () => false
  )
  function toggleAll() {
    for (const key of keys) writeStorage(key, !allChecked)
  }
  return { allChecked, toggleAll }
}

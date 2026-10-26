import { useCallback, useMemo, useSyncExternalStore } from "react"

export const DRAFT_TTL_MS = 24 * 60 * 60 * 1000
const PREFIX = "manaaki:draft:v1:"
const EVENT = "draft-storage"

type StoredDraft = { savedAt: number; base: string | null; value: unknown }

type DraftOptions = { base?: string | null }

const unsavedDrafts = new Map<string, string>()

function storageKey(key: string) {
  return `${PREFIX}${key}`
}

function readRaw(key: string) {
  const unsaved = unsavedDrafts.get(key)
  if (unsaved !== undefined) return unsaved
  try {
    return window.localStorage.getItem(storageKey(key))
  } catch {
    return null
  }
}

function parseDraft(raw: string | null, base: string | null): { value: unknown } | null {
  if (raw === null) return null
  try {
    const stored = JSON.parse(raw) as StoredDraft
    if (Date.now() - stored.savedAt > DRAFT_TTL_MS) return null
    if ((stored.base ?? null) !== base) return null
    return { value: stored.value }
  } catch {
    return null
  }
}

function subscribe(listener: () => void) {
  window.addEventListener(EVENT, listener)
  window.addEventListener("storage", listener)
  return () => {
    window.removeEventListener(EVENT, listener)
    window.removeEventListener("storage", listener)
  }
}

export function readDraft(key: string, options: DraftOptions = {}) {
  return parseDraft(readRaw(key), options.base ?? null)
}

export function writeDraft(key: string, value: unknown, options: DraftOptions = {}) {
  const stored: StoredDraft = { savedAt: Date.now(), base: options.base ?? null, value }
  const serialized = JSON.stringify(stored)
  try {
    window.localStorage.setItem(storageKey(key), serialized)
    unsavedDrafts.delete(key)
  } catch {
    unsavedDrafts.set(key, serialized)
  }
  window.dispatchEvent(new Event(EVENT))
}

export function clearDraft(key: string) {
  unsavedDrafts.delete(key)
  try {
    window.localStorage.removeItem(storageKey(key))
  } catch {}
  window.dispatchEvent(new Event(EVENT))
}

export function forgetAllDrafts() {
  unsavedDrafts.clear()
  try {
    for (const key of Object.keys(window.localStorage))
      if (key.startsWith(PREFIX)) window.localStorage.removeItem(key)
  } catch {}
  window.dispatchEvent(new Event(EVENT))
}

export function pruneExpiredDrafts(now = Date.now()) {
  try {
    for (const key of Object.keys(window.localStorage)) {
      if (!key.startsWith(PREFIX)) continue
      const stored = JSON.parse(window.localStorage.getItem(key) ?? "null") as {
        savedAt?: number
      } | null
      if (!stored?.savedAt || now - stored.savedAt > DRAFT_TTL_MS)
        window.localStorage.removeItem(key)
    }
  } catch {}
}

export function usePersistentDraft<T>(key: string, initialValue: T, options: DraftOptions = {}) {
  const base = options.base ?? null
  const raw = useSyncExternalStore(
    subscribe,
    () => readRaw(key),
    () => null
  )
  const value = useMemo(() => {
    const stored = parseDraft(raw, base)
    return stored ? (stored.value as T) : initialValue
  }, [raw, base, initialValue])
  const setValue = useCallback(
    (next: T | ((previous: T) => T)) => {
      const stored = readDraft(key, { base })
      const previous = stored ? (stored.value as T) : initialValue
      writeDraft(key, next instanceof Function ? next(previous) : next, { base })
    },
    [key, base, initialValue]
  )
  const clear = useCallback(() => clearDraft(key), [key])
  return [value, setValue, clear] as const
}

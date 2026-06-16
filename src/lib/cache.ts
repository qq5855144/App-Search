/**
 * Cross-platform LRU-style TTL cache.
 * Web  → localStorage  (synchronous, zero deps)
 * Native → AsyncStorage (async, pre-installed)
 *
 * Usage:
 *   const data = await getCache<T>(key)          // null when missing/expired
 *   await setCache(key, data, 6 * HOUR)
 *   await deleteCache(key)
 *   await clearCacheByPrefix('search:')
 */

import { Platform } from 'react-native'

export const MINUTE = 60_000
export const HOUR   = 60 * MINUTE
export const DAY    = 24 * HOUR

const IS_WEB = Platform.OS === 'web'

// ─── AsyncStorage (native only) ──────────────────────────────────────────────
let _AS: typeof import('@react-native-async-storage/async-storage').default | null = null
async function getAS() {
  if (!IS_WEB && !_AS) {
    _AS = (await import('@react-native-async-storage/async-storage')).default
  }
  return _AS
}

// ─── Low-level get/set ───────────────────────────────────────────────────────
async function rawGet(key: string): Promise<string | null> {
  if (IS_WEB) {
    try { return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null }
    catch { return null }
  }
  const AS = await getAS()
  return AS ? AS.getItem(key) : null
}

async function rawSet(key: string, value: string): Promise<void> {
  if (IS_WEB) {
    try { if (typeof localStorage !== 'undefined') localStorage.setItem(key, value) }
    catch { /* quota exceeded – silently drop */ }
    return
  }
  const AS = await getAS()
  await AS?.setItem(key, value)
}

async function rawDelete(key: string): Promise<void> {
  if (IS_WEB) {
    try { if (typeof localStorage !== 'undefined') localStorage.removeItem(key) }
    catch { /* ignore */ }
    return
  }
  const AS = await getAS()
  await AS?.removeItem(key)
}

async function rawKeys(): Promise<readonly string[]> {
  if (IS_WEB) {
    try {
      if (typeof localStorage === 'undefined') return []
      return Object.keys(localStorage)
    } catch { return [] }
  }
  const AS = await getAS()
  if (!AS) return []
  const keys = await AS.getAllKeys()
  return keys ?? []
}

// ─── Cache entry type ────────────────────────────────────────────────────────
interface CacheEntry<T> {
  data: T
  created_at: number
  expires_at: number
}

const PREFIX = 'oas_cache:'

// ─── Public API ──────────────────────────────────────────────────────────────

/** Returns cached data if fresh, null otherwise. */
export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await rawGet(PREFIX + key)
    if (!raw) return null
    const entry: CacheEntry<T> = JSON.parse(raw)
    if (Date.now() > entry.expires_at) {
      rawDelete(PREFIX + key) // async cleanup, not awaited
      return null
    }
    return entry.data
  } catch {
    return null
  }
}

/** Stores data with a TTL (milliseconds). */
export async function setCache<T>(key: string, data: T, ttlMs: number): Promise<void> {
  try {
    const entry: CacheEntry<T> = {
      data,
      created_at: Date.now(),
      expires_at: Date.now() + ttlMs,
    }
    await rawSet(PREFIX + key, JSON.stringify(entry))
  } catch {
    /* ignore write failures */
  }
}

/** Removes a single cache entry. */
export async function deleteCache(key: string): Promise<void> {
  await rawDelete(PREFIX + key)
}

/** Removes all entries whose key starts with the given prefix. */
export async function clearCacheByPrefix(prefix: string): Promise<void> {
  try {
    const allKeys = await rawKeys()
    const toDelete = allKeys.filter(
      (k) => k.startsWith(PREFIX + prefix)
    )
    await Promise.all(toDelete.map((k) => rawDelete(k)))
  } catch {
    /* ignore */
  }
}

/** Removes ALL cache entries created by this module. */
export async function clearAllCache(): Promise<void> {
  await clearCacheByPrefix('')
}

/** Builds a canonical cache key for search queries. */
export function searchCacheKey(
  q: string,
  sort: string,
  order: string,
  page: number,
  perPage: number
): string {
  return `search:${q}|${sort}|${order}|${page}|${perPage}`
}

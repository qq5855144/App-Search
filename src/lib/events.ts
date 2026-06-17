/**
 * Local user-behaviour event recorder.
 * Events are stored on-device (same localStorage / SQLite strategy as database.ts).
 * They feed local "my stats" and can later be bulk-uploaded to Supabase.
 *
 * Event types:
 *   search   – keyword searched
 *   view     – app detail page opened
 *   download – install asset downloaded
 *   favorite – app added to / removed from favorites
 */

import { Platform } from 'react-native'

export type EventType = 'search' | 'view' | 'download' | 'favorite'

export type TimeRange = 'day' | 'week' | 'month' | 'all';

function getTimeRangeFilter(range: TimeRange): number {
  const now = Date.now();
  let startTime: number;
  
  switch (range) {
    case 'day':
      startTime = now - 24 * 60 * 60 * 1000;
      break;
    case 'week':
      startTime = now - 7 * 24 * 60 * 60 * 1000;
      break;
    case 'month':
      startTime = now - 30 * 24 * 60 * 60 * 1000;
      break;
    default:
      return 0;
  }
  
  return startTime;
}



export interface AppEvent {
  id: string
  event_type: EventType
  app_id?: number
  app_name?: string
  owner?: string           // GitHub owner (username / org)
  repo?: string            // GitHub repository name
  avatar_url?: string      // GitHub owner avatar URL
  keyword?: string
  platform?: string        // 'android' | 'ios' | 'windows' | ...
  created_at: number       // unix ms
}

const IS_WEB = Platform.OS === 'web'
const STORAGE_KEY = 'oas_events'
const MAX_EVENTS   = 500   // keep only the latest N to avoid unbounded growth

// ─── Web helpers (localStorage) ──────────────────────────────────────────────
function webReadAll(): AppEvent[] {
  try {
    if (typeof localStorage === 'undefined') return []
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}
function webWriteAll(events: AppEvent[]) {
  try {
    if (typeof localStorage !== 'undefined')
      localStorage.setItem(STORAGE_KEY, JSON.stringify(events))
  } catch { /* ignore */ }
}

// ─── Native helpers (SQLite via lazy init in database.ts) ─────────────────────
// For simplicity we use AsyncStorage on native – same dep already in package.json.
let _AS: typeof import('@react-native-async-storage/async-storage').default | null = null
async function getAS() {
  if (!IS_WEB && !_AS)
    _AS = (await import('@react-native-async-storage/async-storage')).default
  return _AS
}
async function nativeReadAll(): Promise<AppEvent[]> {
  try {
    const AS = await getAS()
    const raw = await AS?.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}
async function nativeWriteAll(events: AppEvent[]): Promise<void> {
  try {
    const AS = await getAS()
    await AS?.setItem(STORAGE_KEY, JSON.stringify(events))
  } catch { /* ignore */ }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Record a single user-behaviour event. Fire-and-forget safe. */
export async function addAppEvent(event: Omit<AppEvent, 'id' | 'created_at'>): Promise<void> {
  try {
    const newEvent: AppEvent = {
      ...event,
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      created_at: Date.now(),
    }
    if (IS_WEB) {
      const all = webReadAll()
      all.unshift(newEvent)
      webWriteAll(all.slice(0, MAX_EVENTS))
    } else {
      const all = await nativeReadAll()
      all.unshift(newEvent)
      await nativeWriteAll(all.slice(0, MAX_EVENTS))
    }
  } catch { /* never throw */ }
}

/** Returns all stored events (newest first). */
export async function getAllEvents(): Promise<AppEvent[]> {
  if (IS_WEB) return webReadAll()
  return nativeReadAll()
}

/** Returns events filtered by time range. */
export async function getEventsByTimeRange(timeRange: TimeRange): Promise<AppEvent[]> {
  const startTime = getTimeRangeFilter(timeRange);
  if (startTime === 0) return getAllEvents();
  
  const all = await getAllEvents();
  return all.filter((e) => e.created_at >= startTime);
}

/** Returns counts grouped by event_type. */
export async function getEventCounts(): Promise<Record<EventType, number>> {
  const counts: Record<EventType, number> = { search: 0, view: 0, download: 0, favorite: 0 }
  const all = await getAllEvents()
  for (const e of all) counts[e.event_type] = (counts[e.event_type] || 0) + 1
  return counts
}

/**
 * Returns the top-N most-viewed / most-downloaded apps from local events.
 * Useful for a "my trending" section.
 */
export async function getTopApps(
  eventType: EventType,
  limit = 10
): Promise<{ app_id: number; app_name: string; count: number }[]> {
  const all = await getAllEvents()
  const map = new Map<number, { app_name: string; count: number }>()
  for (const e of all) {
    if (e.event_type !== eventType || !e.app_id) continue
    const prev = map.get(e.app_id)
    map.set(e.app_id, { app_name: e.app_name ?? '', count: (prev?.count ?? 0) + 1 })
  }
  return Array.from(map.entries())
    .map(([app_id, v]) => ({ app_id, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

/**
 * Returns top apps by combined score (downloads * 5 + views * 1 + favorites * 3).
 * Supports time range filtering for day/week/month/all rankings.
 */
export async function getTopAppsByScore(
  limit = 20,
  timeRange: TimeRange = 'all'
): Promise<{ app_id: number; app_name: string; score: number; views: number; downloads: number; favorites: number }[]> {
  const events = await getEventsByTimeRange(timeRange);
  const stats = new Map<number, { app_name: string; views: number; downloads: number; favorites: number }>();
  
  for (const e of events) {
    if (!e.app_id) continue;
    const prev = stats.get(e.app_id) || { app_name: e.app_name ?? '', views: 0, downloads: 0, favorites: 0 };
    
    switch (e.event_type) {
      case 'view':
        prev.views++;
        break;
      case 'download':
        prev.downloads++;
        break;
      case 'favorite':
        prev.favorites++;
        break;
    }
    if (e.app_name) prev.app_name = e.app_name;
    stats.set(e.app_id, prev);
  }
  
  return Array.from(stats.entries())
    .map(([app_id, v]) => ({
      app_id,
      app_name: v.app_name,
      score: v.downloads * 5 + v.views * 1 + v.favorites * 3,
      views: v.views,
      downloads: v.downloads,
      favorites: v.favorites,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Returns popular search keywords from local events.
 * Supports time range filtering.
 */
export async function getPopularKeywords(
  limit = 10,
  timeRange: TimeRange = 'all'
): Promise<{ keyword: string; count: number }[]> {
  const events = await getEventsByTimeRange(timeRange);
  const stats = new Map<string, number>();
  
  for (const e of events) {
    if (e.event_type !== 'search' || !e.keyword) continue;
    const kw = e.keyword.toLowerCase().trim();
    if (kw.length < 2) continue;
    stats.set(kw, (stats.get(kw) || 0) + 1);
  }
  
  return Array.from(stats.entries())
    .map(([keyword, count]) => ({ keyword, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** Clear all local events (e.g. from settings). */
export async function clearAllEvents(): Promise<void> {
  if (IS_WEB) { webWriteAll([]); return }
  const AS = await getAS()
  await AS?.removeItem(STORAGE_KEY)
}

// ─── 设备 ID（匿名，持久化） ──────────────────────────────────────────────────
const DEVICE_ID_KEY = 'oas_device_id'

async function getOrCreateDeviceId(): Promise<string> {
  let id: string | null = null
  if (IS_WEB) {
    try { id = typeof localStorage !== 'undefined' ? localStorage.getItem(DEVICE_ID_KEY) : null } catch { /* ignore */ }
  } else {
    const AS = await getAS()
    id = (await AS?.getItem(DEVICE_ID_KEY)) ?? null
  }
  if (!id) {
    id = `d_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    if (IS_WEB) {
      try { if (typeof localStorage !== 'undefined') localStorage.setItem(DEVICE_ID_KEY, id) } catch { /* ignore */ }
    } else {
      const AS = await getAS()
      await AS?.setItem(DEVICE_ID_KEY, id)
    }
  }
  return id
}

// ─── 上报挂起事件到 Supabase Edge Function ────────────────────────────────────
const UPLOAD_CURSOR_KEY = 'oas_events_upload_cursor'
const UPLOAD_BATCH = 50

async function getUploadCursor(): Promise<string> {
  if (IS_WEB) {
    try { return localStorage.getItem(UPLOAD_CURSOR_KEY) ?? '0' } catch { return '0' }
  }
  const AS = await getAS()
  return (await AS?.getItem(UPLOAD_CURSOR_KEY)) ?? '0'
}
async function saveUploadCursor(cursor: string): Promise<void> {
  if (IS_WEB) {
    try { if (typeof localStorage !== 'undefined') localStorage.setItem(UPLOAD_CURSOR_KEY, cursor) } catch { /* ignore */ }
    return
  }
  const AS = await getAS()
  await AS?.setItem(UPLOAD_CURSOR_KEY, cursor)
}

let _uploading = false   // 简易并发锁，避免多次同时上传

/**
 * 用原生 fetch 直接调用 track-event Edge Function，上传本地事件队列。
 * 内部维护 upload_cursor（已上传到哪个时间戳），带并发锁。
 * Safe to call on app foreground / network reconnect / after each search.
 */
export async function uploadPendingEventsToTrack(): Promise<number> {
  if (_uploading) return 0
  _uploading = true
  try {
    const all = await getAllEvents()
    if (all.length === 0) return 0

    const cursor = Number(await getUploadCursor()) || 0
    const pending = all.filter((e) => e.created_at > cursor).slice(-UPLOAD_BATCH)
    if (pending.length === 0) return 0

    const deviceId = await getOrCreateDeviceId()
    const rows = pending.map((e) => ({
      app_id: e.app_id ?? null,
      app_name: e.app_name ?? null,
      owner: e.owner ?? null,
      repo: e.repo ?? null,
      event_type: e.event_type,
      keyword: e.keyword ?? null,
      platform: e.platform ?? null,
      device_id: deviceId,
    }))

    const SUPABASE_URL = (globalThis as any).process?.env?.EXPO_PUBLIC_SUPABASE_URL
      || 'https://backend.appmiaoda.com/projects/supabase324230210180399104'
    const SUPABASE_KEY = (globalThis as any).process?.env?.EXPO_PUBLIC_SUPABASE_ANON_KEY
      || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNibGsxcnFhNWZrMSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzQ4NTg1MjgyLCJleHAiOjIwNjQxNjEyODJ9.HieIBaJ2S_5RXOlMxAJdVv-2lRgrE_EG3gRrIdUJOk'

    const resp = await fetch(`${SUPABASE_URL}/functions/v1/track-event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'apikey': SUPABASE_KEY,
      },
      body: JSON.stringify({ events: rows }),
    })

    if (!resp.ok) return 0

    const newCursor = Math.max(...pending.map((e) => e.created_at))
    await saveUploadCursor(String(newCursor))
    return pending.length
  } catch {
    return 0
  } finally {
    _uploading = false
  }
}

/** 兼容旧调用签名（保持向后兼容） */
export async function uploadPendingEvents(
  _supabaseFunctionsInvoke: (name: string, opts: { body: unknown }) => Promise<void>
): Promise<number> {
  return uploadPendingEventsToTrack()
}
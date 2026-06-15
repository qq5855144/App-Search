import { Platform } from 'react-native';
import type { AppItem, DownloadRecord, FavoriteItem } from '@/types';

const IS_WEB = Platform.OS === 'web';

// ─── Web 端：用 localStorage 存储，无任何 native 依赖 ─────────────────────
function webGet<T>(key: string, fallback: T): T {
  try {
    if (typeof localStorage === 'undefined') return fallback;
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch { return fallback; }
}
function webSet(key: string, value: unknown) {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

// ─── Native 端：懒加载 SQLite ────────────────────────────────────────────────
const g = globalThis as any;
function initDb() {
  if (IS_WEB) return Promise.resolve(null);
  if (!g.__oas_db) {
    g.__oas_db = import('expo-sqlite').then(({ openDatabaseAsync }) =>
      openDatabaseAsync('openappstore.db')
    ).then(async (db) => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS favorites (
          id TEXT PRIMARY KEY, app_id INTEGER NOT NULL, app_name TEXT NOT NULL,
          owner TEXT NOT NULL, repo TEXT NOT NULL, avatar_url TEXT,
          description TEXT, stars INTEGER DEFAULT 0, language TEXT,
          platforms TEXT, tags TEXT, group_name TEXT DEFAULT '全部收藏', added_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS download_history (
          id TEXT PRIMARY KEY, app_id INTEGER NOT NULL, app_name TEXT NOT NULL,
          owner TEXT NOT NULL, repo TEXT NOT NULL, avatar_url TEXT,
          version TEXT, download_time TEXT NOT NULL, file_size INTEGER DEFAULT 0, html_url TEXT
        );
        CREATE TABLE IF NOT EXISTS search_history (
          id TEXT PRIMARY KEY, keyword TEXT NOT NULL UNIQUE, searched_at TEXT NOT NULL
        );
      `);
      return db;
    });
  }
  return g.__oas_db;
}

// ─── 收藏 ────────────────────────────────────────────────────────────────────
export async function addFavorite(app: AppItem): Promise<void> {
  if (IS_WEB) {
    const favs = webGet<FavoriteItem[]>('oas_favorites', []);
    if (favs.find((f) => f.app_id === app.id)) return;
    favs.unshift({
      id: String(Date.now()), app_id: app.id, app_name: app.name,
      owner: app.owner, repo: app.repo, avatar_url: app.avatar_url,
      description: app.description, stars: app.stars, language: app.language,
      platforms: app.platforms, tags: app.topics || [],
      group_name: '全部收藏', added_at: new Date().toISOString(),
    });
    webSet('oas_favorites', favs);
    return;
  }
  const db = await initDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO favorites (id,app_id,app_name,owner,repo,avatar_url,description,stars,language,platforms,tags,added_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [String(Date.now()), app.id, app.name, app.owner, app.repo, app.avatar_url,
     app.description, app.stars, app.language, JSON.stringify(app.platforms),
     JSON.stringify(app.topics || []), new Date().toISOString()]
  );
}

export async function removeFavorite(appId: number): Promise<void> {
  if (IS_WEB) {
    const favs = webGet<FavoriteItem[]>('oas_favorites', []).filter((f) => f.app_id !== appId);
    webSet('oas_favorites', favs);
    return;
  }
  const db = await initDb();
  await db.runAsync('DELETE FROM favorites WHERE app_id = ?', [appId]);
}

export async function isFavorite(appId: number): Promise<boolean> {
  if (IS_WEB) {
    return webGet<FavoriteItem[]>('oas_favorites', []).some((f) => f.app_id === appId);
  }
  const db = await initDb();
  const row = await db.getFirstAsync<{ cnt: number }>(
    'SELECT COUNT(*) as cnt FROM favorites WHERE app_id = ?', [appId]
  );
  return (row?.cnt ?? 0) > 0;
}

export async function getFavorites(): Promise<FavoriteItem[]> {
  if (IS_WEB) {
    return webGet<FavoriteItem[]>('oas_favorites', []);
  }
  const db = await initDb();
  const rows = await db.getAllAsync<any>('SELECT * FROM favorites ORDER BY added_at DESC');
  return rows.map((r) => ({
    ...r,
    platforms: tryParse(r.platforms, []),
    tags: tryParse(r.tags, []),
  }));
}

export async function getFavoriteStats(): Promise<{ total: number }> {
  if (IS_WEB) {
    return { total: webGet<FavoriteItem[]>('oas_favorites', []).length };
  }
  const db = await initDb();
  const row = await db.getFirstAsync<{ cnt: number }>('SELECT COUNT(*) as cnt FROM favorites');
  return { total: row?.cnt ?? 0 };
}

// ─── 下载记录 ───────────────────────────────────────────────────────────────
export async function addDownloadRecord(record: Omit<DownloadRecord, 'id'>): Promise<void> {
  if (IS_WEB) {
    const list = webGet<DownloadRecord[]>('oas_downloads', []);
    list.unshift({ ...record, id: String(Date.now()) });
    webSet('oas_downloads', list.slice(0, 100));
    return;
  }
  const db = await initDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO download_history (id,app_id,app_name,owner,repo,avatar_url,version,download_time,file_size,html_url)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [String(Date.now()), record.app_id, record.app_name, record.owner, record.repo,
     record.avatar_url, record.version, record.download_time, record.file_size, record.html_url]
  );
}

export async function getDownloadHistory(): Promise<DownloadRecord[]> {
  if (IS_WEB) return webGet<DownloadRecord[]>('oas_downloads', []);
  const db = await initDb();
  return db.getAllAsync<DownloadRecord>('SELECT * FROM download_history ORDER BY download_time DESC LIMIT 100');
}

export async function clearDownloadHistory(): Promise<void> {
  if (IS_WEB) { webSet('oas_downloads', []); return; }
  const db = await initDb();
  await db.runAsync('DELETE FROM download_history');
}

// ─── 搜索历史 ───────────────────────────────────────────────────────────────
export async function addSearchHistory(keyword: string): Promise<void> {
  if (IS_WEB) {
    const list = webGet<string[]>('oas_search_history', []);
    const filtered = list.filter((k) => k !== keyword);
    webSet('oas_search_history', [keyword, ...filtered].slice(0, 20));
    return;
  }
  const db = await initDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO search_history (id,keyword,searched_at) VALUES (?,?,?)`,
    [keyword, keyword, new Date().toISOString()]
  );
}

export async function getSearchHistory(): Promise<string[]> {
  if (IS_WEB) return webGet<string[]>('oas_search_history', []);
  const db = await initDb();
  const rows = await db.getAllAsync<{ keyword: string }>('SELECT keyword FROM search_history ORDER BY searched_at DESC LIMIT 20');
  return rows.map((r) => r.keyword);
}

export async function clearSearchHistory(): Promise<void> {
  if (IS_WEB) { webSet('oas_search_history', []); return; }
  const db = await initDb();
  await db.runAsync('DELETE FROM search_history');
}

function tryParse(v: any, fallback: any) {
  try { return typeof v === 'string' ? JSON.parse(v) : v ?? fallback; } catch { return fallback; }
}

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
        CREATE TABLE IF NOT EXISTS installed_apps (
          id TEXT PRIMARY KEY,
          app_id INTEGER NOT NULL UNIQUE,
          app_name TEXT NOT NULL,
          owner TEXT NOT NULL,
          repo TEXT NOT NULL,
          avatar_url TEXT,
          installed_version TEXT,
          latest_version TEXT,
          ignored_version TEXT,
          last_checked TEXT,
          installed_at TEXT NOT NULL
        );
      `);
      // ── 迁移 v1→v2：补加 UNIQUE(app_id) + 从 download_history 填充历史数据 ──
      await runInstalledMigration(db);
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
  const row = await db.getFirstAsync(
    'SELECT COUNT(*) as cnt FROM favorites WHERE app_id = ?', [appId]
  ) as { cnt: number } | null;
  return (row?.cnt ?? 0) > 0;
}

export async function getFavorites(): Promise<FavoriteItem[]> {
  if (IS_WEB) {
    return webGet<FavoriteItem[]>('oas_favorites', []);
  }
  const db = await initDb();
  const rows = await db.getAllAsync('SELECT * FROM favorites ORDER BY added_at DESC') as any[];
  return rows.map((r: any) => ({
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
  const row = await db.getFirstAsync('SELECT COUNT(*) as cnt FROM favorites') as { cnt: number } | null;
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
  return db.getAllAsync('SELECT * FROM download_history ORDER BY download_time DESC LIMIT 100') as Promise<DownloadRecord[]>;
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
  // 先插入/更新，再删除超出20条的旧记录（按 searched_at 保留最新20条）
  await db.runAsync(
    `INSERT OR REPLACE INTO search_history (id,keyword,searched_at) VALUES (?,?,?)`,
    [keyword, keyword, new Date().toISOString()]
  );
  await db.runAsync(
    `DELETE FROM search_history WHERE id NOT IN (
      SELECT id FROM search_history ORDER BY searched_at DESC LIMIT 20
    )`
  );
}

export async function getSearchHistory(): Promise<string[]> {
  if (IS_WEB) return webGet<string[]>('oas_search_history', []);
  const db = await initDb();
  const rows = await db.getAllAsync('SELECT keyword FROM search_history ORDER BY searched_at DESC LIMIT 20') as { keyword: string }[];
  return rows.map((r: { keyword: string }) => r.keyword);
}

export async function clearSearchHistory(): Promise<void> {
  if (IS_WEB) { webSet('oas_search_history', []); return; }
  const db = await initDb();
  await db.runAsync('DELETE FROM search_history');
}

function tryParse(v: any, fallback: any) {
  try { return typeof v === 'string' ? JSON.parse(v) : v ?? fallback; } catch { return fallback; }
}

// ─── installed_apps 数据库迁移 ───────────────────────────────────────────────
// 问题：v1 建表时 app_id 缺少 UNIQUE 约束，ON CONFLICT(app_id) 静默失败
// 修复：重建带 UNIQUE 约束的表，并从 download_history 填充历史安装记录
const INSTALLED_MIGRATED_KEY = '@oas/installed_v2_migrated';

async function runInstalledMigration(db: any): Promise<void> {
  try {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    const done = await AsyncStorage.getItem(INSTALLED_MIGRATED_KEY);
    if (done === '1') return;

    // 重建带 UNIQUE 约束的表（保留已有数据）
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS installed_apps_v2 (
        id TEXT PRIMARY KEY,
        app_id INTEGER NOT NULL UNIQUE,
        app_name TEXT NOT NULL,
        owner TEXT NOT NULL,
        repo TEXT NOT NULL,
        avatar_url TEXT,
        installed_version TEXT,
        latest_version TEXT,
        ignored_version TEXT,
        last_checked TEXT,
        installed_at TEXT NOT NULL
      );
      -- 迁移旧 installed_apps 数据（如果有）
      INSERT OR IGNORE INTO installed_apps_v2
        SELECT id, app_id, app_name, owner, repo, avatar_url,
               installed_version, latest_version, ignored_version, last_checked, installed_at
        FROM installed_apps;
      -- 从 download_history 填充历史安装记录（version 不为空才算有效）
      INSERT OR IGNORE INTO installed_apps_v2
        (id, app_id, app_name, owner, repo, avatar_url, installed_version, installed_at)
        SELECT id, app_id, app_name, owner, repo, avatar_url, version, download_time
        FROM download_history
        WHERE version IS NOT NULL AND version != '';
      DROP TABLE installed_apps;
      ALTER TABLE installed_apps_v2 RENAME TO installed_apps;
    `);

    await AsyncStorage.setItem(INSTALLED_MIGRATED_KEY, '1');
  } catch { /* 迁移失败不阻断主流程 */ }
}

// ─── 已安装应用 ────────────────────────────────────────────────────────────────
export interface InstalledApp {
  id: string;
  app_id: number;
  app_name: string;
  owner: string;
  repo: string;
  avatar_url: string;
  installed_version: string;
  /** 最新版本（定期从 GitHub 检查后写入） */
  latest_version: string | null;
  /** 用户点击"忽略更新"后记录的版本，与 latest_version 相同则不展示更新提示 */
  ignored_version: string | null;
  last_checked: string | null;
  installed_at: string;
}

export async function upsertInstalledApp(app: Omit<InstalledApp, 'id' | 'latest_version' | 'ignored_version' | 'last_checked'>): Promise<void> {
  if (IS_WEB) {
    const list = webGet<InstalledApp[]>('oas_installed', []);
    const idx = list.findIndex((a) => a.app_id === app.app_id);
    const record: InstalledApp = {
      id: idx >= 0 ? list[idx].id : String(Date.now()),
      latest_version: idx >= 0 ? list[idx].latest_version : null,
      ignored_version: idx >= 0 ? list[idx].ignored_version : null,
      last_checked: idx >= 0 ? list[idx].last_checked : null,
      ...app,
      installed_at: app.installed_at, // 始终使用传入的安装时间
    };
    if (idx >= 0) list[idx] = record; else list.unshift(record);
    webSet('oas_installed', list);
    return;
  }
  const db = await initDb();
  // INSERT … ON CONFLICT UPDATE：重复安装时更新 installed_version 和 installed_at
  await db.runAsync(
    `INSERT INTO installed_apps (id, app_id, app_name, owner, repo, avatar_url, installed_version, installed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(app_id) DO UPDATE SET
       app_name = excluded.app_name,
       avatar_url = excluded.avatar_url,
       installed_version = excluded.installed_version,
       installed_at = excluded.installed_at`,
    [String(Date.now()), app.app_id, app.app_name, app.owner, app.repo,
     app.avatar_url, app.installed_version, app.installed_at],
  );
}

export async function getInstalledApps(): Promise<InstalledApp[]> {
  if (IS_WEB) return webGet<InstalledApp[]>('oas_installed', []);
  const db = await initDb();
  return db.getAllAsync('SELECT * FROM installed_apps ORDER BY installed_at DESC') as Promise<InstalledApp[]>;
}

export async function updateInstalledLatest(
  appId: number,
  latestVersion: string,
): Promise<void> {
  if (IS_WEB) {
    const list = webGet<InstalledApp[]>('oas_installed', []);
    const idx = list.findIndex((a) => a.app_id === appId);
    if (idx >= 0) { list[idx].latest_version = latestVersion; list[idx].last_checked = new Date().toISOString(); }
    webSet('oas_installed', list);
    return;
  }
  const db = await initDb();
  await db.runAsync(
    'UPDATE installed_apps SET latest_version = ?, last_checked = ? WHERE app_id = ?',
    [latestVersion, new Date().toISOString(), appId],
  );
}

/** 批量更新多个已安装应用的最新版本信息 */
export async function batchUpdateInstalledLatest(
  updates: Array<{ appId: number; latestVersion: string }>,
): Promise<void> {
  if (updates.length === 0) return;
  if (IS_WEB) {
    const list = webGet<InstalledApp[]>('oas_installed', []);
    const now = new Date().toISOString();
    for (const { appId, latestVersion } of updates) {
      const idx = list.findIndex((a) => a.app_id === appId);
      if (idx >= 0) {
        list[idx].latest_version = latestVersion;
        list[idx].last_checked = now;
      }
    }
    webSet('oas_installed', list);
    return;
  }
  const db = await initDb();
  const now = new Date().toISOString();
  const stmt = await db.prepareAsync?.(
    'UPDATE installed_apps SET latest_version = ?, last_checked = ? WHERE app_id = ?'
  );
  for (const { appId, latestVersion } of updates) {
    if (stmt) {
      await stmt.executeAsync?.([latestVersion, now, appId])?.catch(() => {});
    } else {
      await db.runAsync(
        'UPDATE installed_apps SET latest_version = ?, last_checked = ? WHERE app_id = ?',
        [latestVersion, now, appId],
      );
    }
  }
  if (stmt?.finalizeAsync) await stmt.finalizeAsync().catch(() => {});
}

export async function ignoreInstalledUpdate(appId: number, version: string): Promise<void> {
  if (IS_WEB) {
    const list = webGet<InstalledApp[]>('oas_installed', []);
    const idx = list.findIndex((a) => a.app_id === appId);
    if (idx >= 0) list[idx].ignored_version = version;
    webSet('oas_installed', list);
    return;
  }
  const db = await initDb();
  await db.runAsync('UPDATE installed_apps SET ignored_version = ? WHERE app_id = ?', [version, appId]);
}

/** 获取需要提示更新的应用列表（latest_version ≠ installed_version 且未忽略） */
export async function getUpdatableApps(): Promise<InstalledApp[]> {
  const all = await getInstalledApps();
  return all.filter((app) => {
    if (!app.latest_version || !app.installed_version) return false;
    // 版本相同或已忽略则跳过
    if (app.latest_version === app.installed_version) return false;
    if (app.ignored_version === app.latest_version) return false;
    return true;
  });
}

export async function removeInstalledApp(appId: number): Promise<void> {
  if (IS_WEB) {
    const list = webGet<InstalledApp[]>('oas_installed', []).filter((a) => a.app_id !== appId);
    webSet('oas_installed', list);
    return;
  }
  const db = await initDb();
  await db.runAsync('DELETE FROM installed_apps WHERE app_id = ?', [appId]);
}

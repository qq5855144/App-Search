import * as SQLite from 'expo-sqlite'

// 将 dbPromise 挂载到 globalThis，防止 Web HMR 热更新后模块重新执行
// 导致重复调用 openDatabaseAsync → 同一 OPFS 文件同时有两个 SyncAccessHandle → NoModificationAllowedError
const g = globalThis as any
if (!g.__openappstoreDb) {
  g.__openappstoreDb = SQLite.openDatabaseAsync('openappstore.db').then(async (db) => {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS favorites (
        id TEXT PRIMARY KEY,
        app_id INTEGER NOT NULL,
        app_name TEXT NOT NULL,
        owner TEXT NOT NULL,
        repo TEXT NOT NULL,
        avatar_url TEXT,
        description TEXT,
        stars INTEGER DEFAULT 0,
        language TEXT,
        platforms TEXT,
        tags TEXT,
        group_name TEXT DEFAULT '全部收藏',
        added_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS download_history (
        id TEXT PRIMARY KEY,
        app_id INTEGER NOT NULL,
        app_name TEXT NOT NULL,
        owner TEXT NOT NULL,
        repo TEXT NOT NULL,
        avatar_url TEXT,
        version TEXT,
        download_time TEXT NOT NULL,
        file_size INTEGER DEFAULT 0,
        html_url TEXT
      );

      CREATE TABLE IF NOT EXISTS search_history (
        id TEXT PRIMARY KEY,
        keyword TEXT NOT NULL UNIQUE,
        searched_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_favorites_group ON favorites(group_name);
    `)
    return db
  }).catch((err: unknown) => {
    // 初始化失败时清掉缓存，允许下次重试
    g.__openappstoreDb = null
    throw err
  })
}

function getDb(): Promise<SQLite.SQLiteDatabase> {
  return g.__openappstoreDb as Promise<SQLite.SQLiteDatabase>
}

export async function addFavorite(item: {
  app_id: number
  app_name: string
  owner: string
  repo: string
  avatar_url: string
  description: string | null
  stars: number
  language: string | null
  platforms: string[]
  group_name?: string
}): Promise<void> {
  const db = await getDb()
  const id = `${item.app_id}_${Date.now()}`
  await db.runAsync(
    `INSERT OR REPLACE INTO favorites (id, app_id, app_name, owner, repo, avatar_url, description, stars, language, platforms, tags, group_name, added_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    item.app_id,
    item.app_name,
    item.owner,
    item.repo,
    item.avatar_url,
    item.description ?? '',
    item.stars,
    item.language ?? '',
    JSON.stringify(item.platforms),
    '[]',
    item.group_name ?? '全部收藏',
    new Date().toISOString()
  )
}

export async function removeFavorite(appId: number): Promise<void> {
  const db = await getDb()
  await db.runAsync('DELETE FROM favorites WHERE app_id = ?', appId)
}

export async function isFavorite(appId: number): Promise<boolean> {
  const db = await getDb()
  const result = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM favorites WHERE app_id = ?', appId)
  return (result?.count ?? 0) > 0
}

export async function getFavorites(groupName?: string): Promise<any[]> {
  const db = await getDb()
  if (groupName && groupName !== '全部收藏') {
    return db.getAllAsync('SELECT * FROM favorites WHERE group_name = ? ORDER BY added_at DESC', groupName)
  }
  return db.getAllAsync('SELECT * FROM favorites ORDER BY added_at DESC')
}

export async function getFavoriteGroups(): Promise<string[]> {
  const db = await getDb()
  const rows = await db.getAllAsync<{ group_name: string }>('SELECT DISTINCT group_name FROM favorites')
  const groups = rows.map((r) => r.group_name)
  if (!groups.includes('全部收藏')) groups.unshift('全部收藏')
  return groups
}

export async function updateFavoriteGroup(appId: number, groupName: string): Promise<void> {
  const db = await getDb()
  await db.runAsync('UPDATE favorites SET group_name = ? WHERE app_id = ?', groupName, appId)
}

export async function addDownloadRecord(item: {
  app_id: number
  app_name: string
  owner: string
  repo: string
  avatar_url: string
  version: string
  file_size?: number
  html_url: string
}): Promise<void> {
  const db = await getDb()
  const id = `${item.app_id}_${Date.now()}`
  await db.runAsync(
    `INSERT INTO download_history (id, app_id, app_name, owner, repo, avatar_url, version, download_time, file_size, html_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    item.app_id,
    item.app_name,
    item.owner,
    item.repo,
    item.avatar_url,
    item.version,
    new Date().toISOString(),
    item.file_size ?? 0,
    item.html_url
  )
}

export async function getDownloadHistory(): Promise<any[]> {
  const db = await getDb()
  return db.getAllAsync('SELECT * FROM download_history ORDER BY download_time DESC')
}

export async function clearDownloadHistory(): Promise<void> {
  const db = await getDb()
  await db.runAsync('DELETE FROM download_history')
}

export async function addSearchHistory(keyword: string): Promise<void> {
  const db = await getDb()
  const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`
  await db.runAsync(
    `INSERT OR REPLACE INTO search_history (id, keyword, searched_at) VALUES (?, ?, ?)`,
    id,
    keyword,
    new Date().toISOString()
  )
  const rows = await db.getAllAsync<{ id: string }>('SELECT id FROM search_history ORDER BY searched_at DESC LIMIT 100 OFFSET 20')
  for (const row of rows) {
    await db.runAsync('DELETE FROM search_history WHERE id = ?', row.id)
  }
}

export async function getSearchHistory(): Promise<string[]> {
  const db = await getDb()
  const rows = await db.getAllAsync<{ keyword: string }>('SELECT keyword FROM search_history ORDER BY searched_at DESC LIMIT 20')
  return rows.map((r) => r.keyword)
}

export async function clearSearchHistory(): Promise<void> {
  const db = await getDb()
  await db.runAsync('DELETE FROM search_history')
}

export async function getFavoriteStats(): Promise<{ total: number; byGroup: Record<string, number>; byPlatform: Record<string, number> }> {
  const db = await getDb()
  const totalResult = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM favorites')
  const total = totalResult?.count ?? 0

  const groupRows = await db.getAllAsync<{ group_name: string; count: number }>(
    'SELECT group_name, COUNT(*) as count FROM favorites GROUP BY group_name'
  )
  const byGroup: Record<string, number> = {}
  for (const row of groupRows) {
    byGroup[row.group_name] = row.count
  }

  const allFavorites = await db.getAllAsync<{ platforms: string }>('SELECT platforms FROM favorites')
  const byPlatform: Record<string, number> = {}
  for (const fav of allFavorites) {
    try {
      const platforms = JSON.parse(fav.platforms || '[]') as string[]
      for (const p of platforms) {
        byPlatform[p] = (byPlatform[p] ?? 0) + 1
      }
    } catch {
      // ignore parse error
    }
  }

  return { total, byGroup, byPlatform }
}

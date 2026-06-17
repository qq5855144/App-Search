import type { AppItem, GitHubRelease } from '@/types'
import { getCache, setCache, HOUR, DAY, searchCacheKey } from '@/lib/cache'

let cachedToken: string | null = null

/**
 * 会话级安装包状态缓存：key = "owner/repo", value = true(有)/false(无)/undefined(未知)
 * 避免同一 repo 在同一会话内重复调用 check_installable_batch
 */
const _installableCache = new Map<string, boolean>()

// 直接读取环境变量，避免依赖 supabase-js 客户端层
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || ''
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ''
const EDGE_FN_URL = `${SUPABASE_URL}/functions/v1/github-proxy`

export async function setGitHubToken(token: string | null) {
  cachedToken = token
}

export async function getGitHubToken(): Promise<string | null> {
  return cachedToken
}

const GITHUB_API = 'https://api.github.com'

/**
 * 原生 fetch 调用 Edge Function，代理失败时不抛出，返回 null 交由调用方处理
 */
async function callEdgeFunction(body: Record<string, unknown>): Promise<any | null> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null
  try {
    const res = await fetch(EDGE_FN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'apikey': SUPABASE_KEY,
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

/** GitHub API 直连兜底：搜索仓库 */
async function searchGitHubDirect(
  q: string,
  options: { sort?: string; order?: string; page?: number; per_page?: number } = {}
): Promise<{ items: AppItem[]; total_count: number }> {
  console.log('[GitHub] Using direct API for query:', q);
  const params = new URLSearchParams({
    q,
    sort: options.sort || 'stars',
    order: options.order || 'desc',
    page: String(options.page || 1),
    per_page: String(options.per_page || 30),
  })
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (cachedToken) headers['Authorization'] = `Bearer ${cachedToken}`
  const res = await fetch(`${GITHUB_API}/search/repositories?${params}`, { headers })
  console.log('[GitHub] Direct API response status:', res.status);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.warn('[GitHub] API error:', res.status, text);
    throw new Error(`GitHub API 请求失败 (${res.status})`)
  }
  const json = await res.json()
  const items = (json.items || []).map((item: any) => mapRepoToApp(item))
  console.log('[GitHub] Direct API returned', items.length, 'items');
  return { items, total_count: json.total_count || 0 }
}

export async function searchRepos(
  q: string,
  options: { sort?: string; order?: string; page?: number; per_page?: number; installableOnly?: boolean } = {}
): Promise<{ items: AppItem[]; total_count: number }> {
  const sort = options.sort || 'stars'
  const order = options.order || 'desc'
  const page = options.page || 1
  const perPage = options.per_page || 30
  const installableOnly = options.installableOnly ?? true   // 全局默认：只展示有安装包的应用
  const cacheKey = searchCacheKey(q, sort, order, page, perPage) + (installableOnly ? ':installable' : '')
  const ttl = 6 * HOUR

  // 命中缓存直接返回，后台刷新
  // 注意：只信任 filtered===true 的缓存；兜底（未真正过滤）的结果不写缓存
  const cached = await getCache<{ items: AppItem[]; total_count: number; filtered?: boolean }>(cacheKey)
  if (cached && (!installableOnly || cached.filtered === true)) {
    ;(async () => {
      try {
        const fresh = await _fetchAndFilter(q, sort, order, page, perPage, installableOnly)
        if (fresh.filtered && fresh.items.length > 0) {
          await setCache(cacheKey, { items: fresh.items, total_count: fresh.total_count, filtered: true }, ttl)
        }
      } catch (e) {
        console.warn('[GitHub] Background refresh failed:', e)
      }
    })()
    return { items: cached.items, total_count: cached.total_count }
  }

  const result = await _fetchAndFilter(q, sort, order, page, perPage, installableOnly)
  // 只缓存经过真正过滤的结果，兜底数据不入缓存
  if (result.filtered && result.items.length > 0) {
    await setCache(cacheKey, { items: result.items, total_count: result.total_count, filtered: true }, ttl)
  }
  return { items: result.items, total_count: result.total_count }
}

/**
 * 搜索 + 可选 installableOnly 过滤，统一入口
 * 返回 filtered=true 表示经过了真实的安装包过滤，filtered=false 为超时/失败兜底
 */
async function _fetchAndFilter(
  q: string, sort: string, order: string, page: number, perPage: number,
  installableOnly: boolean,
): Promise<{ items: AppItem[]; total_count: number; filtered: boolean }> {
  const raw = await _fetchSearchRepos(q, sort, order, page, perPage)
  if (!installableOnly) return { ...raw, filtered: false }

  const { items: enriched, timedOut } = await enrichApps(raw.items)
  const installable = enriched.filter((a) => a.has_installable_assets)

  if (installable.length > 0) {
    return { items: installable, total_count: raw.total_count, filtered: true }
  }

  // 区分两种 installable.length===0 的情况：
  // 1. 超时/失败（timedOut=true）→ 兜底展示原始列表（不入缓存）
  // 2. API 响应了但全部 ok=false（可能限速）→ 也走兜底，但不缓存，下次重试
  if (timedOut) {
    return { items: raw.items, total_count: raw.total_count, filtered: false }
  }
  // API 有响应但无安装包：说明这批结果确实没有安装包，返回空（不展示脏数据）
  return { items: [], total_count: raw.total_count, filtered: true }
}

async function _fetchSearchRepos(
  q: string, sort: string, order: string, page: number, perPage: number
): Promise<{ items: AppItem[]; total_count: number }> {
  const proxyData = await callEdgeFunction({
    action: 'search',
    params: { q, sort, order, page, per_page: perPage },
    token: cachedToken,
  })
  if (proxyData?.data?.items) {
    const items = proxyData.data.items.map((item: any) => mapRepoToApp(item))
    return { items, total_count: proxyData.data.total_count || 0 }
  }
  return searchGitHubDirect(q, { sort, order, page, per_page: perPage })
}

/**
 * 批量查询安装包信息，返回 enriched 结果（可直接 await）
 * - 命中会话缓存的 repo 直接跳过，只请求未知的
 * - 失败或超时时返回原始 items（兜底不报错），同时通过 timedOut 标记告知调用方
 * - timeoutMs 默认 8000ms
 */
export async function enrichApps(
  items: AppItem[],
  timeoutMs = 8000,
): Promise<{ items: AppItem[]; timedOut: boolean }> {
  if (items.length === 0) return { items, timedOut: false }

  // 1. 已缓存的直接处理，只对未知的发请求
  const unknown = items.filter((a) => !_installableCache.has(`${a.owner}/${a.repo}`))
  const fromCache = items.map((a): AppItem => {
    const cached = _installableCache.get(`${a.owner}/${a.repo}`)
    if (cached === true) return { ...a, has_installable_assets: true }
    return a
  })

  if (unknown.length === 0) {
    return { items: fromCache, timedOut: false }
  }

  try {
    const repos = unknown.map((a) => ({ owner: a.owner, repo: a.repo }))
    const fetchPromise = callEdgeFunction({
      action: 'check_installable_batch',
      params: { repos },
      token: cachedToken,
    })
    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), timeoutMs)
    )
    const data = await Promise.race([fetchPromise, timeoutPromise])

    // 超时：返回已缓存处理的结果，标记 timedOut=true
    if (!Array.isArray(data?.data)) return { items: fromCache, timedOut: true }

    // 写入会话缓存
    for (const r of data.data) {
      if (r?.key) _installableCache.set(r.key, r.ok === true)
    }

    const resultMap = new Map<string, any>()
    for (const r of data.data) {
      if (r?.key) resultMap.set(r.key, r)
    }

    return {
      timedOut: false,
      items: fromCache.map((app): AppItem => {
        // 已从缓存处理过（has_installable_assets=true）则保留
        if (app.has_installable_assets) return app
        const r = resultMap.get(`${app.owner}/${app.repo}`)
        if (!r?.ok) return app
        return {
          ...app,
          has_installable_assets: true,
          latest_version: r.latest_version ?? app.latest_version,
          latest_release_date: r.latest_release_date ?? app.latest_release_date,
          total_downloads: r.total_downloads ?? 0,
          platforms: [...new Set([...app.platforms, ...(r.platforms || [])])],
        }
      }),
    }
  } catch {
    return { items: fromCache, timedOut: true }
  }
}

/**
 * 通用安装包过滤：适用于任何含 owner/repo 的列表（AppItem、RankItem 等）
 * - 优先使用会话级 _installableCache，命中缓存的 repo 无需网络请求
 * - 超时（8s）或 Edge Function 失败时兜底返回原列表（避免空列表）
 */
export async function filterInstallable<T extends { owner: string; repo: string }>(
  items: T[],
  timeoutMs = 8000,
): Promise<T[]> {
  if (items.length === 0) return items

  // 1. 先用缓存处理已知结果
  const unknown = items.filter((a) => !_installableCache.has(`${a.owner}/${a.repo}`))
  const cachedInstallable = items.filter((a) => _installableCache.get(`${a.owner}/${a.repo}`) === true)

  if (unknown.length === 0) {
    // 全部命中缓存：直接过滤
    return cachedInstallable.length > 0 ? cachedInstallable : items
  }

  try {
    const repos = unknown.map((a) => ({ owner: a.owner, repo: a.repo }))
    const fetchPromise = callEdgeFunction({
      action: 'check_installable_batch',
      params: { repos },
      token: cachedToken,
    })
    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), timeoutMs)
    )
    const data = await Promise.race([fetchPromise, timeoutPromise])

    // 超时兜底：返回已知可安装 + 未知的（保守展示）
    if (!Array.isArray(data?.data)) {
      const knownGood = items.filter((a) => _installableCache.get(`${a.owner}/${a.repo}`) !== false)
      return knownGood.length > 0 ? knownGood : items
    }

    // 写入会话缓存
    for (const r of data.data) {
      if (r?.key) _installableCache.set(r.key, r.ok === true)
    }

    const installableKeys = new Set<string>()
    for (const r of data.data) {
      if (r?.ok && r?.key) installableKeys.add(r.key)
    }
    // 合并：缓存命中的 + 本次 API 确认的
    const filtered = items.filter(
      (a) => _installableCache.get(`${a.owner}/${a.repo}`) === true
    )
    return filtered.length > 0 ? filtered : items
  } catch {
    return items
  }
}

/**
 * @deprecated 改用 enrichApps（可 await），此函数保留供旧代码兼容
 */
export async function enrichAppsInBackground(
  items: AppItem[],
  onUpdate: (enriched: AppItem[]) => void
): Promise<void> {
  const { items: enriched } = await enrichApps(items)
  if (enriched !== items) onUpdate(enriched)
}

export async function fetchRepoDetail(owner: string, repo: string): Promise<AppItem> {
  const cacheKey = `repo:${owner}/${repo}`
  const cached = await getCache<AppItem>(cacheKey)
  if (cached) return cached
  const data = await callEdgeFunction({
    action: 'repo',
    params: { owner, repo },
    token: cachedToken,
  })
  let result: AppItem
  if (data?.data) {
    result = mapRepoToApp(data.data)
  } else {
    // 代理失败 → 直连
    const headers: Record<string, string> = { 'Accept': 'application/vnd.github+json' }
    if (cachedToken) headers['Authorization'] = `Bearer ${cachedToken}`
    const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}`, { headers })
    if (!res.ok) throw new Error(`获取仓库详情失败 (${res.status})`)
    result = mapRepoToApp(await res.json())
  }
  await setCache(cacheKey, result, 12 * HOUR)
  return result
}

export async function fetchReleases(owner: string, repo: string, page = 1): Promise<GitHubRelease[]> {
  const cacheKey = `releases:${owner}/${repo}:${page}`
  const cached = await getCache<GitHubRelease[]>(cacheKey)
  if (cached) return cached
  const data = await callEdgeFunction({
    action: 'releases',
    params: { owner, repo, page },
    token: cachedToken,
  })
  const list = data?.data ?? null
  const parseReleases = (arr: any[]) => arr.map((r: any) => ({
    id: r.id,
    tag_name: r.tag_name,
    name: r.name || r.tag_name,
    body: r.body,
    published_at: r.published_at,
    html_url: r.html_url,
    assets: (r.assets || []).map((a: any) => ({
      name: a.name,
      size: a.size,
      download_count: a.download_count || 0,
      browser_download_url: a.browser_download_url,
    })),
  }))
  let result: GitHubRelease[]
  if (Array.isArray(list)) {
    result = parseReleases(list)
  } else {
    // 代理失败 → 直连
    const headers: Record<string, string> = { 'Accept': 'application/vnd.github+json' }
    if (cachedToken) headers['Authorization'] = `Bearer ${cachedToken}`
    const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/releases?page=${page}&per_page=10`, { headers })
    if (!res.ok) throw new Error(`获取 Releases 失败 (${res.status})`)
    result = parseReleases(await res.json())
  }
  await setCache(cacheKey, result, DAY)
  return result
}

export async function fetchReadme(owner: string, repo: string): Promise<string> {
  const cacheKey = `readme:${owner}/${repo}`
  const cached = await getCache<string>(cacheKey)
  if (cached !== null) return cached
  const data = await callEdgeFunction({
    action: 'readme',
    params: { owner, repo },
    token: cachedToken,
  })
  // GitHub API 返回的 base64 中含 `\n`，必须先清除再 atob
  const raw = (data?.data?.content || '').replace(/\s/g, '')
  if (!raw) return ''
  let result = ''
  try {
    const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0))
    result = new TextDecoder().decode(bytes)
  } catch {
    try { result = decodeURIComponent(escape(atob(raw))) } catch { result = '' }
  }
  await setCache(cacheKey, result, DAY)
  return result
}

export async function fetchContributors(owner: string, repo: string): Promise<Array<{ login: string; avatar_url: string; html_url: string }>> {
  const data = await callEdgeFunction({
    action: 'contributors',
    params: { owner, repo },
    token: cachedToken,
  })
  return (data.data || []).map((c: any) => ({
    login: c.login,
    avatar_url: c.avatar_url,
    html_url: c.html_url,
  }))
}

export async function fetchRateLimit(): Promise<{ remaining: number; limit: number; reset: number }> {
  const data = await callEdgeFunction({
    action: 'rate_limit',
    token: cachedToken,
  })
  const core = data.data?.resources?.core || data.data?.rate || { remaining: 0, limit: 60, reset: 0 }
  return {
    remaining: core.remaining ?? 0,
    limit: core.limit ?? 60,
    reset: core.reset ?? 0,
  }
}

function mapRepoToApp(item: any): AppItem {
  const platforms = detectPlatforms(item.topics || [])
  const ownerLogin = item.owner?.login || ''
  const ownerAvatar = item.owner?.avatar_url || null

  let finalAvatarUrl = ownerAvatar
  if (!finalAvatarUrl && ownerLogin) {
    finalAvatarUrl = `https://github.com/${ownerLogin}.png`
  }
  if (!finalAvatarUrl) {
    finalAvatarUrl = ''
  }

  return {
    id: item.id,
    full_name: item.full_name,
    name: item.name,
    description: item.description,
    owner: ownerLogin,
    repo: item.name,
    avatar_url: finalAvatarUrl,
    stars: item.stargazers_count || 0,
    forks: item.forks_count || 0,
    language: item.language,
    topics: item.topics || [],
    platforms,
    latest_version: null,
    latest_release_date: null,
    html_url: item.html_url,
    updated_at: item.updated_at || item.pushed_at,
    license: item.license?.name || item.license?.spdx_id || null,
    archived: item.archived ?? false,
    open_issues_count: item.open_issues_count ?? 0,
    total_downloads: 0,
    has_installable_assets: false,
  }
}

function detectPlatforms(topics: string[]): string[] {
  const map: Record<string, string> = {
    'android-app': 'Android',
    'android': 'Android',
    'ios-app': 'iOS',
    'ios': 'iOS',
    'macos': 'macOS',
    'macos-app': 'macOS',
    'windows': 'Windows',
    'windows-app': 'Windows',
    'linux': 'Linux',
    'linux-app': 'Linux',
    'electron': 'Windows',
    'cross-platform': 'Android',
  }
  const platforms = new Set<string>()
  for (const topic of topics) {
    const lower = topic.toLowerCase()
    if (map[lower]) platforms.add(map[lower])
  }
  return Array.from(platforms)
}

export function getPlatformFromFilename(filename: string): string | null {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.apk')) return 'Android'
  if (lower.endsWith('.ipa')) return 'iOS'
  if (lower.endsWith('.dmg') || lower.endsWith('.pkg')) return 'macOS'
  if (lower.endsWith('.exe') || lower.endsWith('.msi')) return 'Windows'
  if (lower.endsWith('.deb') || lower.endsWith('.rpm') || lower.endsWith('.appimage')
    || lower.endsWith('.flatpak') || lower.endsWith('.snap')) return 'Linux'
  return null
}

/** 只保留真实安装包（.apk/.ipa/.dmg/.exe/.msi/.deb/.rpm/.appimage/.flatpak/.snap/.pkg） */
export function filterInstallAssets(assets: GitHubRelease['assets']) {
  const installExts = ['.apk', '.ipa', '.dmg', '.pkg', '.exe', '.msi',
    '.deb', '.rpm', '.appimage', '.flatpak', '.snap']
  return assets.filter((a) => {
    const lower = a.name.toLowerCase()
    return installExts.some((ext) => lower.endsWith(ext))
  })
}

/** 提取签名/哈希校验文件（.asc/.sig/.sha256/.sha512/.md5） */
export function filterVerificationAssets(assets: GitHubRelease['assets']) {
  const verifyExts = ['.asc', '.sig', '.sha256', '.sha512', '.md5']
  return assets.filter((a) => {
    const lower = a.name.toLowerCase()
    return verifyExts.some((ext) => lower.endsWith(ext))
  })
}

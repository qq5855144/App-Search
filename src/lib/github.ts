import type { AppItem, GitHubRelease } from '@/types'
import { getCache, setCache, HOUR, DAY, searchCacheKey } from '@/lib/cache'
import { Platform } from 'react-native'

let cachedToken: string | null = null

/** 跨平台 base64 解码（Hermes 引擎无全局 atob） */
function base64Decode(str: string): string {
  // 清理空白字符
  const cleaned = str.replace(/\s/g, '');
  try {
    // 优先使用原生 atob
    if (typeof atob === 'function') return atob(cleaned);
  } catch { /* fall through */ }
  // 回退：手动解码
  try {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let output = '';
    let i = 0;
    while (i < cleaned.length) {
      const enc1 = chars.indexOf(cleaned.charAt(i++));
      const enc2 = chars.indexOf(cleaned.charAt(i++));
      const enc3 = chars.indexOf(cleaned.charAt(i++));
      const enc4 = chars.indexOf(cleaned.charAt(i++));
      const chr1 = (enc1 << 2) | (enc2 >> 4);
      const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
      const chr3 = ((enc3 & 3) << 6) | enc4;
      output += String.fromCharCode(chr1);
      if (enc3 !== 64) output += String.fromCharCode(chr2);
      if (enc4 !== 64) output += String.fromCharCode(chr3);
    }
    return output;
  } catch {
    return '';
  }
}

/**
 * 会话级安装包状态缓存（内存 Map）：快速访问，重启后清空
 * 持久化缓存通过 cache.ts（AsyncStorage/localStorage）实现 24h TTL
 */
const _installableCache = new Map<string, boolean>()

const INSTALLABLE_TTL = 24 * DAY  // 持久化缓存 24h
const _installableCacheKey = (owner: string, repo: string) => `installable:${owner}/${repo}`

/** 读取持久化缓存，同时写入内存 Map */
async function getInstallableStatus(owner: string, repo: string): Promise<boolean | null> {
  const key = `${owner}/${repo}`
  if (_installableCache.has(key)) return _installableCache.get(key)!
  const persisted = await getCache<boolean>(_installableCacheKey(owner, repo))
  if (persisted !== null) {
    _installableCache.set(key, persisted)
    return persisted
  }
  return null
}

/** 写入内存 Map + 持久化缓存 */
async function setInstallableStatus(owner: string, repo: string, installable: boolean): Promise<void> {
  _installableCache.set(`${owner}/${repo}`, installable)
  await setCache(_installableCacheKey(owner, repo), installable, INSTALLABLE_TTL)
}

// 直接读取环境变量，避免依赖 supabase-js 客户端层
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://backend.appmiaoda.com/projects/supabase324230210180399104'
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNibGsxcnFhNWZrMSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzQ4NTg1MjgyLCJleHAiOjIwNjQxNjEyODJ9.HieIBaJ2S_5RXOlMxAJdVv-2lRgrE_eEG3gRrIdUJOk'
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
  if (res.status === 403 || res.status === 429) {
    console.warn('[GitHub] API rate limit exceeded');
    throw new Error('GitHub API 请求次数已达上限，请稍后再试或在「我的」页面配置 Token')
  }
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

/**
 * 仅获取原始搜索结果（不做安装包过滤），供前端两阶段加载使用
 */
export async function fetchSearchReposRaw(
  q: string,
  options: { sort?: string; order?: string; page?: number; per_page?: number } = {}
): Promise<{ items: AppItem[]; total_count: number }> {
  const sort = options.sort || 'stars'
  const order = options.order || 'desc'
  const page = options.page || 1
  const perPage = options.per_page || 50
  return _fetchSearchRepos(q, sort, order, page, perPage)
}

const SMART_SEARCH_URL = `${SUPABASE_URL}/functions/v1/smart-search`

/**
 * 服务端一站式搜索：catalog + GitHub + 安装包过滤，单次请求完成
 * 彻底替代 fetchSearchReposRaw + filterInstallable 两阶段方案
 */
export async function smartSearch(
  q: string,
  options: { sort?: string; order?: string; page?: number; per_page?: number } = {}
): Promise<{ items: AppItem[]; total_count: number; has_more: boolean }> {
  const body = {
    q,
    sort: options.sort || 'stars',
    order: options.order || 'desc',
    page: options.page || 1,
    per_page: options.per_page || 30,
    token: cachedToken,
  }
  try {
    const res = await fetch(SMART_SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'apikey': SUPABASE_KEY,
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`smart-search ${res.status}`)
    const json = await res.json()
    const items = (json.data || []).map((item: any) =>
      item.has_installable_assets !== undefined ? item : mapRepoToApp(item)
    )
    return { items, total_count: json.total_count || 0, has_more: json.has_more ?? false }
  } catch {
    // 降级：直接 GitHub 搜索（不过滤，兜底展示）
    const raw = await _fetchSearchRepos(q, body.sort, body.order, body.page, body.per_page)
    return { items: raw.items, total_count: raw.total_count, has_more: false }
  }
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

  // 使用 filterInstallable：
  // - 确认有发行版的保留，确认没有的剔除
  // - 超时/限速时只剔除缓存明确为 false 的，保留未知项目（不误杀）
  // - 全部未知或全部被误判时兜底返回原列表（永不返回空）
  const filtered = await filterInstallable(raw.items)
  const wasFiltered = filtered.length < raw.items.length
  return { items: filtered, total_count: raw.total_count, filtered: wasFiltered }
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
 * - 优先读取持久化缓存（24h TTL），缓存命中的 repo 不发 API 请求
 * - 只对未知的 repo 调用 check_installable_batch
 * - 失败或超时时返回已知缓存结果，通过 timedOut 标记告知调用方
 */
export async function enrichApps(
  items: AppItem[],
  timeoutMs = 8000,
): Promise<{ items: AppItem[]; timedOut: boolean }> {
  if (items.length === 0) return { items, timedOut: false }

  // 1. 并行读取持久化缓存
  const statusList = await Promise.all(
    items.map((a) => getInstallableStatus(a.owner, a.repo))
  )

  const unknown = items.filter((_, i) => statusList[i] === null)
  const fromCache = items.map((a, i): AppItem =>
    statusList[i] === true ? { ...a, has_installable_assets: true } : a
  )

  if (unknown.length === 0) return { items: fromCache, timedOut: false }

  try {
    const repos = unknown.map((a) => ({ owner: a.owner, repo: a.repo }))
    const data = await Promise.race([
      callEdgeFunction({ action: 'check_installable_batch', params: { repos }, token: cachedToken }),
      new Promise<null>((r) => setTimeout(() => r(null), timeoutMs)),
    ])

    if (!Array.isArray(data?.data)) return { items: fromCache, timedOut: true }

    // 持久化写入（ok:true 和 ok:false 都缓存，避免重复查询）
    await Promise.all(
      data.data.map((r: any) => r?.key
        ? setInstallableStatus(r.key.split('/')[0], r.key.split('/')[1], r.ok === true)
        : Promise.resolve()
      )
    )

    const resultMap = new Map<string, any>()
    for (const r of data.data) {
      if (r?.key) resultMap.set(r.key, r)
    }

    return {
      timedOut: false,
      items: fromCache.map((app): AppItem => {
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
 * 通用安装包过滤：适用于任何含 owner/repo 的列表
 * - 优先读取持久化缓存，命中的 repo 不发 API 请求
 * - 超时或失败时兜底返回原列表
 */
export async function filterInstallable<T extends { owner: string; repo: string }>(
  items: T[],
  timeoutMs = 8000,
): Promise<T[]> {
  if (items.length === 0) return items

  // 1. 并行读取持久化缓存
  const statusList = await Promise.all(
    items.map((a) => getInstallableStatus(a.owner, a.repo))
  )
  const unknown = items.filter((_, i) => statusList[i] === null)

  if (unknown.length === 0) {
    // 全部命中缓存，严格按过滤结果返回
    return items.filter((_, i) => statusList[i] === true)
  }

  try {
    const repos = unknown.map((a) => ({ owner: a.owner, repo: a.repo }))
    const data = await Promise.race([
      callEdgeFunction({ action: 'check_installable_batch', params: { repos }, token: cachedToken }),
      new Promise<null>((r) => setTimeout(() => r(null), timeoutMs)),
    ])

    if (!Array.isArray(data?.data)) {
      // 超时：严格只保留已确认有安装包的，未知状态也剔除（宁可结果少，不展示无安装包项目）
      return items.filter((_, i) => statusList[i] === true)
    }

    // 持久化写入（ok:true 和 ok:false 都缓存）
    await Promise.all(
      data.data.map((r: any) => r?.key
        ? setInstallableStatus(r.key.split('/')[0], r.key.split('/')[1], r.ok === true)
        : Promise.resolve()
      )
    )

    // 严格过滤规则（只有明确确认有安装包才展示）：
    // - ok:true  → 确认有安装包，保留
    // - ok:false → 确认无安装包，剔除
    // - ok:null / 无结果（网络错误）→ 状态未知，剔除（宁缺毋滥，等下次缓存命中再展示）
    const resultMap = new Map<string, boolean | null>()
    for (const r of data.data) {
      if (r?.key) resultMap.set(r.key, r.ok === true ? true : r.ok === false ? false : null)
    }

    return items.filter((_, i) => {
      const key = `${items[i].owner}/${items[i].repo}`
      if (statusList[i] === true) return true    // L1/L2 缓存确认有
      if (statusList[i] === false) return false  // L1/L2 缓存确认无

      // statusList === null → 未知，以 API 结果为准
      const apiResult = resultMap.get(key)
      return apiResult === true                  // 严格：只保留 ok:true，null/undefined/false 均剔除
    })
  } catch {
    // 异常时严格处理：只保留已确认有安装包的
    return items.filter((_, i) => statusList[i] === true)
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
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    }
    if (cachedToken) headers['Authorization'] = `Bearer ${cachedToken}`
    const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}`, { headers })
    if (res.status === 403 || res.status === 429) {
      throw new Error('GitHub API 请求次数已达上限，请稍后再试或在「我的」页面配置 Token')
    }
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

  const data = await callEdgeFunction({
    action: 'releases',
    params: { owner, repo, page },
    token: cachedToken,
  })
  const list = data?.data ?? null
  let result: GitHubRelease[]
  if (Array.isArray(list)) {
    result = parseReleases(list)
  } else {
    // 代理失败 → 直连
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    }
    if (cachedToken) headers['Authorization'] = `Bearer ${cachedToken}`
    const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/releases?page=${page}&per_page=10`, { headers })
    if (res.status === 403 || res.status === 429) {
      // 速率限制：返回空数组，不抛错
      console.warn(`[GitHub] Releases 速率限制: ${owner}/${repo}`);
      return [];
    }
    if (!res.ok) throw new Error(`获取 Releases 失败 (${res.status})`)
    result = parseReleases(await res.json())
  }
  // 仅缓存非空结果
  if (result.length > 0) {
    await setCache(cacheKey, result, DAY)
  }
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
  // GitHub API 返回的 base64 中含 `\n`，必须先清除再解码
  const raw = base64Decode(data?.data?.content || '')
  if (!raw) return ''
  let result = ''
  try {
    const bytes = Uint8Array.from(raw, (c) => c.charCodeAt(0))
    result = new TextDecoder().decode(bytes)
  } catch {
    try { result = decodeURIComponent(escape(raw)) } catch { result = '' }
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
  try {
    const data = await callEdgeFunction({
      action: 'rate_limit',
      token: cachedToken,
    })
    const core = data?.data?.resources?.core || data?.data?.rate || { remaining: 0, limit: 60, reset: 0 }
    return {
      remaining: core.remaining ?? 0,
      limit: core.limit ?? 60,
      reset: core.reset ?? 0,
    }
  } catch {
    // 查询失败时返回默认值，不阻断 UI
    return { remaining: 0, limit: 60, reset: 0 }
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

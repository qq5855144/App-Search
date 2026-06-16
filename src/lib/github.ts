import type { AppItem, GitHubRelease } from '@/types'
import { getCache, setCache, HOUR, DAY, searchCacheKey } from '@/lib/cache'

let cachedToken: string | null = null

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
  if (!res.ok) throw new Error(`GitHub API 请求失败 (${res.status})`)
  const json = await res.json()
  const items = (json.items || []).map((item: any) => mapRepoToApp(item))
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
  const cacheKey = searchCacheKey(q, sort, order, page, perPage)
  const ttl = 6 * HOUR

  // Return cached result immediately if available
  const cached = await getCache<{ items: AppItem[]; total_count: number }>(cacheKey)
  if (cached) {
    // Refresh in background without blocking
    ;(async () => {
      try {
        const fresh = await _fetchSearchRepos(q, sort, order, page, perPage)
        await setCache(cacheKey, fresh, ttl)
      } catch { /* silent */ }
    })()
    return cached
  }

  const result = await _fetchSearchRepos(q, sort, order, page, perPage)
  await setCache(cacheKey, result, ttl)
  return result
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
 * 后台静默增强：批量查询安装包信息，填充版本/下载量/平台字段
 * 不过滤结果，不阻塞首屏，失败时静默忽略
 */
export async function enrichAppsInBackground(
  items: AppItem[],
  onUpdate: (enriched: AppItem[]) => void
): Promise<void> {
  if (items.length === 0) return
  try {
    const repos = items.map((a) => ({ owner: a.owner, repo: a.repo }))
    const data = await callEdgeFunction({
      action: 'check_installable_batch',
      params: { repos },
      token: cachedToken,
    })
    if (!Array.isArray(data?.data)) return

    const resultMap = new Map<string, any>()
    for (const r of data.data) {
      if (r?.key) resultMap.set(r.key, r)
    }

    const enriched = items.map((app): AppItem => {
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
    })
    onUpdate(enriched)
  } catch {
    // 静默失败，不影响已展示的列表
  }
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

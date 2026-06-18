/**
 * smart-search Edge Function
 * 服务端一站式搜索：catalog 查询 + GitHub 补充 + 安装包过滤，一次请求完成
 *
 * 请求体: { q, sort?, order?, page?, per_page?, token? }
 * 响应体: { data: AppItem[], total_count: number, has_more: boolean }
 */
import { createClient } from 'npm:@supabase/supabase-js@2'

const GITHUB_API = 'https://api.github.com'
const INSTALL_EXTS = ['.apk', '.ipa', '.dmg', '.pkg', '.exe', '.msi',
  '.deb', '.rpm', '.appimage', '.flatpak', '.snap']
const VERIFY_EXTS = ['.asc', '.sig', '.sha256', '.sha512', '.md5']
const CACHE_TTL_HAS  = 7 * 24 * 60 * 60 * 1000   // 7天
const CACHE_TTL_NONE = 1 * 24 * 60 * 60 * 1000   // 1天

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function makeSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  )
}

function githubHeaders(token?: string | null) {
  const h: Record<string, string> = {
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'OpenAppStore/1.0',
  }
  if (token) h['Authorization'] = `Bearer ${token}`
  return h
}

function detectPlatform(filename: string): string | null {
  const l = filename.toLowerCase()
  if (l.endsWith('.apk')) return 'Android'
  if (l.endsWith('.ipa')) return 'iOS'
  if (l.endsWith('.dmg') || l.endsWith('.pkg')) return 'macOS'
  if (l.endsWith('.exe') || l.endsWith('.msi')) return 'Windows'
  if (['.deb', '.rpm', '.appimage', '.flatpak', '.snap'].some((e) => l.endsWith(e))) return 'Linux'
  return null
}

function mapRow(row: any) {
  return {
    id: row.id,
    owner: row.owner,
    repo: row.repo,
    name: row.name || row.repo,
    full_name: row.full_name || `${row.owner}/${row.repo}`,
    description: row.description || '',
    stars: row.stars || 0,
    forks: row.forks || 0,
    language: row.language || '',
    topics: row.topics || [],
    platforms: row.platforms || [],
    latest_version: row.latest_version || '',
    latest_release_date: row.latest_release_date || '',
    total_downloads: row.total_downloads || 0,
    updated_at: row.updated_at || '',
    html_url: row.html_url || `https://github.com/${row.owner}/${row.repo}`,
    avatar_url: row.avatar_url || `https://avatars.githubusercontent.com/${row.owner}?size=120`,
    has_installable_assets: true,
  }
}

function mapGitHubRepo(item: any) {
  return {
    id: item.id,
    owner: item.owner?.login || '',
    repo: item.name || '',
    name: item.name || '',
    full_name: item.full_name || '',
    description: item.description || '',
    stars: item.stargazers_count || 0,
    forks: item.forks_count || 0,
    language: item.language || '',
    topics: item.topics || [],
    platforms: [],
    latest_version: '',
    latest_release_date: '',
    total_downloads: 0,
    updated_at: item.updated_at || '',
    html_url: item.html_url || '',
    avatar_url: `https://avatars.githubusercontent.com/${item.owner?.login}?size=120`,
    has_installable_assets: false,
  }
}

/** 批量检查 GitHub releases，返回有安装包的项目（同时写入 DB 缓存） */
async function filterByReleases(
  supabase: any,
  items: any[],
  token: string | null,
): Promise<any[]> {
  if (items.length === 0) return []

  // 1. 读 DB 缓存
  const { data: cachedRows } = await supabase
    .from('repo_installable_cache')
    .select('owner, repo, has_release, latest_version, latest_release_date, total_downloads, platforms, checked_at')
    .in('owner', items.map((r) => r.owner))

  const now = Date.now()
  const cacheMap = new Map<string, any>()
  for (const row of (cachedRows || [])) {
    const age = now - new Date(row.checked_at).getTime()
    const ttl = row.has_release ? CACHE_TTL_HAS : CACHE_TTL_NONE
    if (age < ttl) cacheMap.set(`${row.owner}/${row.repo}`, row)
  }

  // 2. 缓存命中 → 直接决策
  const cached_pass: any[] = []
  const unknown: any[] = []
  for (const item of items) {
    const key = `${item.owner}/${item.repo}`
    const row = cacheMap.get(key)
    if (row) {
      if (row.has_release) {
        cached_pass.push({
          ...item,
          has_installable_assets: true,
          latest_version: row.latest_version || item.latest_version,
          latest_release_date: row.latest_release_date || item.latest_release_date,
          total_downloads: row.total_downloads || 0,
          platforms: row.platforms || [],
        })
      }
      // has_release=false → 剔除
    } else {
      unknown.push(item)
    }
  }

  if (unknown.length === 0) return cached_pass

  // 3. 对未知仓库并发查 Releases API（限 30 个防限速）
  const freshPass: any[] = []
  const upserts: any[] = []

  const settled = await Promise.allSettled(
    unknown.slice(0, 30).map(async (item) => {
      const { owner, repo } = item
      try {
        const r = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/releases?per_page=5`, {
          headers: githubHeaders(token),
        })
        if (r.status === 403 || r.status === 429 || r.status >= 500) {
          return { item, ok: null }  // 限速/服务器错误 → 未知，保留
        }
        if (!r.ok) {
          return { item, ok: false }
        }
        const releases = await r.json() as any[]
        for (const rel of releases) {
          const assets: any[] = rel.assets || []
          const installAssets = assets.filter((a) =>
            INSTALL_EXTS.some((ext) => a.name.toLowerCase().endsWith(ext))
          )
          if (installAssets.length === 0) continue
          const verifyAssets = assets.filter((a) =>
            VERIFY_EXTS.some((ext) => a.name.toLowerCase().endsWith(ext))
          )
          const platforms = [...new Set(
            installAssets.map((a) => detectPlatform(a.name)).filter(Boolean)
          )] as string[]
          const total_downloads = installAssets.reduce(
            (sum, a) => sum + (a.download_count || 0), 0
          )
          return {
            item, ok: true,
            latest_version: rel.tag_name,
            latest_release_date: rel.published_at,
            total_downloads, platforms,
          }
        }
        return { item, ok: false }
      } catch {
        return { item, ok: null }
      }
    })
  )

  for (const result of settled) {
    if (result.status !== 'fulfilled' || !result.value) continue
    const { item, ok, latest_version, latest_release_date, total_downloads, platforms } = result.value
    if (ok === true) {
      freshPass.push({
        ...item,
        has_installable_assets: true,
        latest_version: latest_version || '',
        latest_release_date: latest_release_date || '',
        total_downloads: total_downloads || 0,
        platforms: platforms || [],
      })
      upserts.push({
        owner: item.owner, repo: item.repo,
        has_release: true,
        latest_version: latest_version || null,
        latest_release_date: latest_release_date || null,
        total_downloads: total_downloads || 0,
        platforms: platforms || [],
        checked_at: new Date().toISOString(),
      })
    } else if (ok === false) {
      upserts.push({
        owner: item.owner, repo: item.repo,
        has_release: false,
        checked_at: new Date().toISOString(),
      })
    }
    // ok === null → 未知，不写缓存，下次重试
  }

  // 4. 异步写入缓存（不阻塞响应）
  if (upserts.length > 0) {
    supabase.from('repo_installable_cache')
      .upsert(upserts, { onConflict: 'owner,repo' })
      .then(() => {})
      .catch(() => {})
  }

  return [...cached_pass, ...freshPass]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const {
      q = '',
      sort = 'stars',
      order = 'desc',
      page = 1,
      per_page = 30,
      token = null,
    } = await req.json()

    if (!q.trim()) {
      return new Response(JSON.stringify({ data: [], total_count: 0, has_more: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = makeSupabase()
    const term = q.trim()
    const offset = (page - 1) * per_page

    // ── Step 1: 查 app_catalog（天然已过滤有安装包）────────────────────────
    let catalogQuery = supabase
      .from('app_catalog')
      .select('*', { count: 'exact' })
      .eq('archived', false)
      .not('latest_version', 'is', null)
      .or(`name.ilike.%${term}%,repo.ilike.%${term}%,full_name.ilike.%${term}%,description.ilike.%${term}%,owner.ilike.%${term}%`)

    const sortMap: Record<string, { column: string; ascending: boolean }> = {
      stars:     { column: 'stars',           ascending: false },
      updated:   { column: 'updated_at',      ascending: false },
      forks:     { column: 'forks',           ascending: false },
      downloads: { column: 'total_downloads', ascending: false },
    }
    const { column, ascending } = sortMap[sort] || sortMap.stars
    catalogQuery = catalogQuery
      .order(column, { ascending })
      .range(offset, offset + per_page - 1)

    const { data: catalogData, count: catalogCount } = await catalogQuery
    const catalogItems = (catalogData || []).map(mapRow)
    const catalogIds = new Set(catalogItems.map((r: any) => r.id))

    // ── Step 2: 若 catalog 结果充足，直接返回 ─────────────────────────────
    if (catalogItems.length >= per_page) {
      return new Response(JSON.stringify({
        data: catalogItems,
        total_count: catalogCount || catalogItems.length,
        has_more: offset + per_page < (catalogCount || 0),
        source: 'catalog',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ── Step 3: catalog 不足，补充 GitHub 搜索 ────────────────────────────
    const need = per_page - catalogItems.length
    let githubItems: any[] = []
    let githubTotal = 0

    try {
      const ghUrl = `${GITHUB_API}/search/repositories?q=${encodeURIComponent(term)}&sort=${sort}&order=${order}&page=${page}&per_page=${need + 20}`
      const ghRes = await fetch(ghUrl, { headers: githubHeaders(token) })
      if (ghRes.ok) {
        const ghJson = await ghRes.json()
        githubTotal = ghJson.total_count || 0
        // 去掉 catalog 已有的，避免重复
        githubItems = (ghJson.items || [])
          .filter((item: any) => !catalogIds.has(item.id))
          .map(mapGitHubRepo)
      }
    } catch {
      // GitHub 失败 → 仅返回 catalog 结果
    }

    // ── Step 4: 对 GitHub 结果做安装包过滤 ──────────────────────────────
    const filteredGitHub = await filterByReleases(supabase, githubItems.slice(0, need + 10), token)

    // ── Step 5: 合并，截断至 per_page ────────────────────────────────────
    const merged = [...catalogItems, ...filteredGitHub].slice(0, per_page)
    const total = (catalogCount || 0) + githubTotal

    return new Response(JSON.stringify({
      data: merged,
      total_count: total,
      has_more: merged.length === per_page && total > offset + per_page,
      source: catalogItems.length > 0 ? 'mixed' : 'github',
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err: any) {
    console.error('[smart-search]', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

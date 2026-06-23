import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const GITHUB_API_BASE = 'https://api.github.com'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function githubHeaders(token?: string) {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'OpenAppStore/1.0',
  }
  if (token) headers['Authorization'] = `Bearer ${token}`
  return headers
}

const INSTALL_EXTS = ['.apk', '.ipa', '.dmg', '.pkg', '.exe', '.msi',
  '.deb', '.rpm', '.appimage', '.flatpak', '.snap']
const VERIFY_EXTS = ['.asc', '.sig', '.sha256', '.sha512', '.md5']

function detectPlatform(filename: string): string | null {
  const l = filename.toLowerCase()
  if (l.endsWith('.apk')) return 'Android'
  if (l.endsWith('.ipa')) return 'iOS'
  if (l.endsWith('.dmg') || l.endsWith('.pkg')) return 'macOS'
  if (l.endsWith('.exe') || l.endsWith('.msi')) return 'Windows'
  if (['.deb', '.rpm', '.appimage', '.flatpak', '.snap'].some((e) => l.endsWith(e))) return 'Linux'
  return null
}

/** 创建 Supabase service_role 客户端（仅 Edge Function 内部使用） */
function makeSupabase() {
  const url = Deno.env.get('SUPABASE_URL')!
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  return createClient(url, key, { auth: { persistSession: false } })
}

/** 缓存有效期：has_release=true 缓存6小时，false 缓存12小时（可能新增发行版） */
const CACHE_TTL_HAS  = 6 * 60 * 60 * 1000   // 6小时（原7天，版本号过期太慢）
const CACHE_TTL_NONE = 12 * 60 * 60 * 1000  // 12小时

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, params, token } = await req.json()
    let url: string
    let method = 'GET'

    switch (action) {
      case 'search': {
        const q = params?.q || 'topic:android-app OR topic:ios-app OR topic:electron'
        const sort = params?.sort || 'stars'
        const order = params?.order || 'desc'
        const page = params?.page || 1
        const perPage = params?.per_page || 30
        url = `${GITHUB_API_BASE}/search/repositories?q=${encodeURIComponent(q)}&sort=${sort}&order=${order}&page=${page}&per_page=${perPage}`
        break
      }
      case 'repo': {
        const owner = params?.owner
        const repo = params?.repo
        if (!owner || !repo) throw new Error('Missing owner or repo')
        url = `${GITHUB_API_BASE}/repos/${owner}/${repo}`
        break
      }
      case 'releases': {
        const owner = params?.owner
        const repo = params?.repo
        const page = params?.page || 1
        if (!owner || !repo) throw new Error('Missing owner or repo')
        url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/releases?page=${page}&per_page=20`
        break
      }
      case 'readme': {
        const owner = params?.owner
        const repo = params?.repo
        if (!owner || !repo) throw new Error('Missing owner or repo')
        url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/readme`
        break
      }
      case 'contributors': {
        const owner = params?.owner
        const repo = params?.repo
        if (!owner || !repo) throw new Error('Missing owner or repo')
        url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contributors?per_page=10`
        break
      }
      case 'rate_limit': {
        url = `${GITHUB_API_BASE}/rate_limit`
        break
      }

      // 批量校验仓库是否含安装包
      // 优先读 repo_installable_cache（共享 DB 缓存）
      // 缓存未命中才调用 GitHub API，并将结果写回 DB
      // 规则：只有明确确认 has_release=false 时才返回 ok:false
      //       网络错误/API 异常一律返回 ok:null（未知），客户端保留该条目
      case 'check_installable_batch': {
        const repos: Array<{ owner: string; repo: string }> = params?.repos || []
        const supabase = makeSupabase()

        // ── 1. 批量读 DB 缓存（不限数量，DB 缓存覆盖所有传入 repos）──
        const { data: cachedRows } = await supabase
          .from('repo_installable_cache')
          .select('owner, repo, has_release, latest_version, latest_release_date, total_downloads, platforms, checked_at')
          .in('owner', repos.map((r) => r.owner))

        const now = Date.now()
        const cacheMap = new Map<string, any>()
        for (const row of (cachedRows || [])) {
          const age = now - new Date(row.checked_at).getTime()
          const ttl = row.has_release ? CACHE_TTL_HAS : CACHE_TTL_NONE
          if (age < ttl) {
            cacheMap.set(`${row.owner}/${row.repo}`, row)
          }
        }

        // ── 2. 区分缓存命中 / 未命中 ─────────────────────────────
        const toFetch = repos.filter((r) => !cacheMap.has(`${r.owner}/${r.repo}`))
        const cachedResults = repos
          .filter((r) => cacheMap.has(`${r.owner}/${r.repo}`))
          .map(({ owner, repo }) => {
            const row = cacheMap.get(`${owner}/${repo}`)
            return row.has_release
              ? { key: `${owner}/${repo}`, ok: true, from_cache: true,
                  latest_version: row.latest_version,
                  latest_release_date: row.latest_release_date,
                  total_downloads: row.total_downloads,
                  platforms: row.platforms }
              : { key: `${owner}/${repo}`, ok: false, from_cache: true }
          })

        // ── 3. GitHub API 查询未缓存的仓库（限 50 个防限速）────────
        const freshResults: any[] = []
        const dbUpserts: any[] = []

        if (toFetch.length > 0) {
          const settled = await Promise.allSettled(
            toFetch.slice(0, 50).map(async ({ owner, repo }) => {
              const key = `${owner}/${repo}`
              try {
                const r = await fetch(
                  `${GITHUB_API_BASE}/repos/${owner}/${repo}/releases?per_page=5`,
                  { headers: githubHeaders(token) }
                )
                // 限速(403/429)或服务器错误：返回 ok:null（未知），不缓存，不误杀
                if (r.status === 403 || r.status === 429 || r.status >= 500) {
                  return { key, ok: null }
                }
                // 404 / 仓库不存在：明确无发行版
                if (!r.ok) return { key, ok: false }

                const releases = await r.json() as any[]
                for (const rel of releases) {
                  const assets: any[] = rel.assets || []
                  const installAssets = assets.filter((a: any) =>
                    INSTALL_EXTS.some((ext) => a.name.toLowerCase().endsWith(ext))
                  )
                  if (installAssets.length === 0) continue

                  const verifyAssets = assets.filter((a: any) =>
                    VERIFY_EXTS.some((ext) => a.name.toLowerCase().endsWith(ext))
                  )
                  const platforms = [...new Set(
                    installAssets.map((a: any) => detectPlatform(a.name)).filter(Boolean)
                  )] as string[]
                  const total_downloads = installAssets.reduce(
                    (sum: number, a: any) => sum + (a.download_count || 0), 0
                  )
                  return {
                    key, ok: true,
                    latest_version: rel.tag_name,
                    latest_release_date: rel.published_at,
                    total_downloads,
                    platforms,
                    install_assets: installAssets.map((a: any) => ({
                      name: a.name, size: a.size,
                      download_count: a.download_count,
                      browser_download_url: a.browser_download_url,
                    })),
                    verification_assets: verifyAssets.map((a: any) => ({
                      name: a.name,
                      browser_download_url: a.browser_download_url,
                    })),
                  }
                }
                // releases 为空或无安装包：明确无
                return { key, ok: false }
              } catch {
                // 网络异常：未知，不误杀
                return { key, ok: null }
              }
            })
          )

          for (const s of settled) {
            if (s.status !== 'fulfilled' || !s.value) continue
            const v = s.value as any
            freshResults.push(v)
            // ok:null（未知）不写入 DB 缓存，避免污染
            if (v.ok !== null) {
              const [o, rp] = v.key.split('/')
              dbUpserts.push({
                owner: o, repo: rp,
                has_release: v.ok === true,
                latest_version: v.latest_version ?? null,
                latest_release_date: v.latest_release_date ?? null,
                total_downloads: v.total_downloads ?? 0,
                platforms: v.platforms ?? [],
                checked_at: new Date().toISOString(),
              })
            }
          }

          // ── 4. 超出 50 个限制的仓库补充为 ok:null（未知，客户端严格模式下不展示）──
          for (const { owner, repo } of toFetch.slice(50)) {
            freshResults.push({ key: `${owner}/${repo}`, ok: null })
          }

          // ── 5. 异步写回 DB 缓存 ───────────────────────────────────
          if (dbUpserts.length > 0) {
            supabase.from('repo_installable_cache')
              .upsert(dbUpserts, { onConflict: 'owner,repo' })
              .then(({ error }) => { if (error) console.error('[cache upsert]', error.message) })
          }
        }

        const data = [...cachedResults, ...freshResults]
        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      default:
        throw new Error(`Unknown action: ${action}`)
    }

    const response = await fetch(url, { method, headers: githubHeaders(token) })

    if (!response.ok) {
      const errorText = await response.text()
      return new Response(
        JSON.stringify({ error: `GitHub API error: ${response.status}`, details: errorText }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const data = await response.json()
    return new Response(JSON.stringify({ data, headers: Object.fromEntries(response.headers.entries()) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

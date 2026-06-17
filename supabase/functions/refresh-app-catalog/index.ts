/**
 * refresh-app-catalog Edge Function (v2)
 * 从 GitHub 搜索候选项目 → 验证 Release 是否有可安装包 → upsert 到 app_catalog。
 *
 * 关键改进：
 * 1. 分批处理 + 超时保护（默认 45 秒，Edge Function 上限 60 秒）
 * 2. 先查 catalog，跳过 24 小时内检查过的项目（增量更新）
 * 3. 并发控制：同时检查 3 个 release
 * 4. 速率限制保护：使用 Deno.env.get('GITHUB_TOKEN')
 */
import { createClient } from 'npm:@supabase/supabase-js@2'

const GITHUB_API = 'https://api.github.com'
const INSTALL_EXTS = ['.apk', '.ipa', '.dmg', '.pkg', '.exe', '.msi',
  '.deb', '.rpm', '.appimage', '.flatpak', '.snap']

// ============================================================
// 配置
// ============================================================
const MAX_RUNTIME_MS = 45 * 1000     // 硬停止：45 秒（留给 Supabase 一些余量）
const MAX_REPOS_PER_RUN = 80         // 单次运行最多检查多少个仓库
const PARALLEL_CHECKS = 3            // 同时检查多少个 release
const RECHECK_AFTER_HOURS = 24       // 已检查的项目多久后重新检查
const PER_PAGE = 30                  // GitHub API 每页条目

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// GitHub 搜索词（保持轻量：只搜前 1 页即可，每天定时跑足以发现新应用）
const SEARCH_QUERIES = [
  'topic:android-app stars:>500 archived:false',
  'topic:ios-app stars:>500 archived:false',
  'topic:electron stars:>500 archived:false',
  'topic:flutter stars:>500 archived:false',
  'topic:react-native stars:>300 archived:false',
  'topic:macos-app stars:>300 archived:false',
  'topic:windows-app stars:>300 archived:false',
  'topic:linux-app stars:>300 archived:false',
]

// ============================================================
// 工具函数
// ============================================================
function ghHeaders(token?: string): Record<string, string> {
  const h: Record<string, string> = {
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'OpenAppStore-Catalog/2.0',
  }
  // 优先使用 Deno env 中的 token（5000 req/h），其次用客户端传入的
  const t = Deno.env.get('GITHUB_TOKEN') || token
  if (t) h['Authorization'] = `Bearer ${t}`
  return h
}

function detectPlatform(filename: string): string | null {
  const l = filename.toLowerCase()
  if (l.endsWith('.apk')) return 'Android'
  if (l.endsWith('.ipa')) return 'iOS'
  if (l.endsWith('.dmg') || l.endsWith('.pkg')) return 'macOS'
  if (l.endsWith('.exe') || l.endsWith('.msi')) return 'Windows'
  if (['.deb', '.rpm', '.appimage', '.flatpak', '.snap']
    .some((ext) => l.endsWith(ext))) return 'Linux'
  return null
}

function detectPlatformsFromTopics(topics: string[]): string[] {
  const map: Record<string, string> = {
    'android': 'Android', 'android-app': 'Android',
    'ios': 'iOS', 'ios-app': 'iOS',
    'macos': 'macOS', 'macos-app': 'macOS',
    'windows': 'Windows', 'windows-app': 'Windows',
    'linux': 'Linux', 'linux-app': 'Linux',
    'electron': 'Windows',
  }
  return [...new Set(topics.map((t) => map[t.toLowerCase()]).filter(Boolean))] as string[]
}

// 检查某个仓库是否有可安装的 release
async function checkInstallable(
  owner: string,
  repo: string,
  token?: string,
): Promise<{
  ok: boolean
  latest_version?: string
  latest_release_date?: string
  total_downloads?: number
  platforms?: string[]
} | null> {
  try {
    const r = await fetch(
      `${GITHUB_API}/repos/${owner}/${repo}/releases?per_page=3`,
      { headers: ghHeaders(token) },
    )
    if (!r.ok) return { ok: false }
    const releases = await r.json() as any[]
    for (const rel of releases) {
      const assets: any[] = rel.assets || []
      const installAssets = assets.filter((a: any) =>
        INSTALL_EXTS.some((ext) => a.name.toLowerCase().endsWith(ext)),
      )
      if (installAssets.length === 0) continue
      const platforms = [...new Set(
        installAssets.map((a: any) => detectPlatform(a.name)).filter(Boolean),
      )] as string[]
      return {
        ok: true,
        latest_version: rel.tag_name || rel.name,
        latest_release_date: rel.published_at,
        total_downloads: installAssets.reduce(
          (s: number, a: any) => s + (a.download_count || 0),
          0,
        ),
        platforms,
      }
    }
    return { ok: false }
  } catch (_e) {
    return { ok: false }
  }
}

// ============================================================
// 主入口
// ============================================================
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const startTime = Date.now()
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )

  let { token } = await req.json().catch(() => ({}))
  let totalUpserted = 0
  let totalChecked = 0
  let totalSkipped = 0

  try {
    // --- 1. 获取当前 catalog，跳过最近 24 小时内检查过的项目 ---
    const existing = new Map<string, Date>()
    try {
      const { data: rows } = await supabase
        .from('app_catalog')
        .select('owner, repo, last_checked_at')
      ;(rows || []).forEach((r: any) => {
        if (r?.owner && r?.repo && r.last_checked_at) {
          existing.set(`${r.owner}/${r.repo}`, new Date(r.last_checked_at))
        }
      })
      console.log(`[refresh] Existing catalog: ${existing.size} rows`)
    } catch (e) {
      console.warn(`[refresh] Failed to query existing catalog:`, e)
    }

    // --- 2. 分批遍历 GitHub 搜索词 ---
    const seenKeys = new Set<string>([...existing.keys()]) // 避免同一轮内重复处理
    const recheckThreshold = new Date(startTime - RECHECK_AFTER_HOURS * 3600 * 1000)

    outer:
    for (const q of SEARCH_QUERIES) {
      // 超时检查：避免超过 Edge Function 限制
      if (Date.now() - startTime > MAX_RUNTIME_MS) {
        console.warn(`[refresh] Time budget exceeded, stopping early`)
        break outer
      }
      if (totalChecked >= MAX_REPOS_PER_RUN) break outer

      const url = `${GITHUB_API}/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&page=1&per_page=${PER_PAGE}`
      let res: Response
      try {
        res = await fetch(url, { headers: ghHeaders(token) })
      } catch (e) {
        console.warn(`[refresh] Network error for query "${q}":`, e)
        continue
      }
      if (!res.ok) {
        if (res.status === 403 || res.status === 429) {
          console.warn(`[refresh] GitHub rate limited, stopping early (status=${res.status})`)
          break outer
        }
        console.warn(`[refresh] Search failed for "${q}": ${res.status}`)
        continue
      }

      let json: any
      try {
        json = await res.json()
      } catch {
        continue
      }
      const repos: any[] = json.items || []
      if (repos.length === 0) continue

      // --- 3. 过滤：跳过最近检查过的项目 ---
      const candidates: Array<{ owner: string; name: string; repo: any }> = []
      for (const repo of repos) {
        const owner = repo.owner?.login || ''
        const name = repo.name || ''
        if (!owner || !name) continue

        const key = `${owner}/${name}`
        if (seenKeys.has(key)) {
          totalSkipped++
          // 如果最近已检查过，跳过
          const lastCheck = existing.get(key)
          if (lastCheck && lastCheck > recheckThreshold) continue
        }
        seenKeys.add(key)

        // 跳过归档仓库（catalog 表有 archived=false 过滤）
        if (repo.archived) continue

        candidates.push({ owner, name, repo })
        if (totalChecked + candidates.length >= MAX_REPOS_PER_RUN) break
      }

      // --- 4. 批量并发检查 release（限制并发数）---
      const chunks: Array<Array<{ owner: string; name: string; repo: any }>> = []
      for (let i = 0; i < candidates.length; i += PARALLEL_CHECKS) {
        chunks.push(candidates.slice(i, i + PARALLEL_CHECKS))
      }

      for (const chunk of chunks) {
        if (Date.now() - startTime > MAX_RUNTIME_MS) break outer
        if (totalChecked >= MAX_REPOS_PER_RUN) break outer

        const results = await Promise.all(
          chunk.map((c) => checkInstallable(c.owner, c.name, token)),
        )

        for (let i = 0; i < chunk.length; i++) {
          const c = chunk[i]
          const r = results[i]
          totalChecked++

          if (!r) continue // 网络错误等，跳过
          if (!r.ok) continue // 无安装包，跳过

          const topicsFromGH: string[] = c.repo.topics || []
          const platformsFromRelease: string[] = r.platforms || []
          const platformsFromTopics: string[] = detectPlatformsFromTopics(topicsFromGH)
          const platforms = [...new Set([...platformsFromRelease, ...platformsFromTopics])]

          const row = {
            id: c.repo.id,
            owner: c.owner,
            repo: c.name,
            full_name: c.repo.full_name,
            name: c.repo.name,
            description: c.repo.description || null,
            avatar_url: c.repo.owner?.avatar_url || null,
            stars: c.repo.stargazers_count || 0,
            forks: c.repo.forks_count || 0,
            language: c.repo.language || null,
            topics: topicsFromGH,
            platforms,
            latest_version: r.latest_version,
            latest_release_date: r.latest_release_date,
            total_downloads: r.total_downloads || 0,
            html_url: c.repo.html_url,
            updated_at: c.repo.updated_at || c.repo.pushed_at,
            license: c.repo.license?.spdx_id || c.repo.license?.name || null,
            open_issues_count: c.repo.open_issues_count || 0,
            archived: false,
            has_installable_assets: true,
            last_checked_at: new Date().toISOString(),
          }

          const { error } = await supabase
            .from('app_catalog')
            .upsert(row, { onConflict: 'id' })
          if (error) {
            console.warn(`[refresh] Upsert failed ${c.owner}/${c.name}:`, error.message)
          } else {
            totalUpserted++
          }
        }
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`[refresh] Done. checked=${totalChecked}, upserted=${totalUpserted}, skipped=${totalSkipped}, elapsed=${elapsed}s`)

    return new Response(
      JSON.stringify({
        ok: true,
        checked: totalChecked,
        upserted: totalUpserted,
        skipped: totalSkipped,
        elapsed: `${elapsed}s`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err: any) {
    console.error('[refresh-app-catalog] FATAL:', err)
    return new Response(
      JSON.stringify({ error: err.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})

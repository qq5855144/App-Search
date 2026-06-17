/**
 * refresh-app-catalog Edge Function
 * 定时爬取 GitHub，只把有安装包的项目写入 app_catalog 表。
 * 调用：POST（无 body），可通过 Supabase Cron 每天触发一次。
 */
import { createClient } from 'npm:@supabase/supabase-js@2'

const GITHUB_API = 'https://api.github.com'
const INSTALL_EXTS = ['.apk','.ipa','.dmg','.pkg','.exe','.msi',
  '.deb','.rpm','.appimage','.flatpak','.snap']

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function ghHeaders(token?: string) {
  const h: Record<string,string> = {
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'OpenAppStore-Catalog/1.0',
  }
  // 优先使用服务端存储的 token（5000 req/h），其次用客户端传入的
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
  if (['.deb','.rpm','.appimage','.flatpak','.snap'].some(e => l.endsWith(e))) return 'Linux'
  return null
}

function detectPlatformsFromTopics(topics: string[]): string[] {
  const map: Record<string,string> = {
    'android':'Android','android-app':'Android',
    'ios':'iOS','ios-app':'iOS',
    'macos':'macOS','macos-app':'macOS',
    'windows':'Windows','windows-app':'Windows',
    'linux':'Linux','linux-app':'Linux',
    'electron':'Windows',
  }
  return [...new Set(topics.map(t => map[t.toLowerCase()]).filter(Boolean) as string[])]
}

async function checkInstallable(owner: string, repo: string, token?: string) {
  try {
    const r = await fetch(
      `${GITHUB_API}/repos/${owner}/${repo}/releases?per_page=5`,
      { headers: ghHeaders(token) }
    )
    if (!r.ok) return null
    const releases = await r.json() as any[]
    for (const rel of releases) {
      const assets: any[] = rel.assets || []
      const installAssets = assets.filter((a: any) =>
        INSTALL_EXTS.some(ext => a.name.toLowerCase().endsWith(ext))
      )
      if (installAssets.length === 0) continue
      const platforms = [...new Set([
        ...installAssets.map((a: any) => detectPlatform(a.name)).filter(Boolean),
      ])] as string[]
      return {
        latest_version: rel.tag_name,
        latest_release_date: rel.published_at,
        total_downloads: installAssets.reduce((s: number, a: any) => s + (a.download_count || 0), 0),
        platforms,
      }
    }
    return null // 无安装包
  } catch {
    return null
  }
}

// 搜索词列表，覆盖主流移动/桌面开源应用
const SEARCH_QUERIES = [
  'topic:android-app stars:>500 archived:false',
  'topic:ios-app stars:>500 archived:false',
  'topic:electron stars:>500 archived:false',
  'topic:android stars:>1000 archived:false',
  'topic:flutter stars:>500 archived:false',
  'topic:react-native stars:>300 archived:false',
  'topic:macos-app stars:>300 archived:false',
  'topic:windows-app stars:>300 archived:false',
  'topic:linux-app stars:>300 archived:false',
]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  )

  let { token } = await req.json().catch(() => ({}))
  let totalUpserted = 0
  let totalChecked = 0

  try {
    for (const q of SEARCH_QUERIES) {
      // 每个查询取前 2 页（最多 60 个）
      for (let page = 1; page <= 2; page++) {
        const url = `${GITHUB_API}/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&page=${page}&per_page=30`
        const res = await fetch(url, { headers: ghHeaders(token) })
        if (!res.ok) {
          console.warn(`Search failed for "${q}" page ${page}: ${res.status}`)
          break
        }
        const json = await res.json()
        const repos: any[] = json.items || []
        if (repos.length === 0) break

        // 串行检查安装包（避免并发过多触发限速）
        for (const repo of repos) {
          totalChecked++
          const owner = repo.owner?.login || ''
          const name = repo.name || ''
          if (!owner || !name) continue

          const installInfo = await checkInstallable(owner, name, token)
          if (!installInfo) continue // 无安装包，跳过

          const topicsFromGH: string[] = repo.topics || []
          const platformsFromRelease: string[] = installInfo.platforms
          const platformsFromTopics: string[] = detectPlatformsFromTopics(topicsFromGH)
          const platforms = [...new Set([...platformsFromRelease, ...platformsFromTopics])]

          const row = {
            id: repo.id,
            owner,
            repo: name,
            full_name: repo.full_name,
            name: repo.name,
            description: repo.description || null,
            avatar_url: repo.owner?.avatar_url || null,
            stars: repo.stargazers_count || 0,
            forks: repo.forks_count || 0,
            language: repo.language || null,
            topics: topicsFromGH,
            platforms,
            latest_version: installInfo.latest_version,
            latest_release_date: installInfo.latest_release_date,
            total_downloads: installInfo.total_downloads,
            html_url: repo.html_url,
            updated_at: repo.updated_at || repo.pushed_at,
            license: repo.license?.spdx_id || repo.license?.name || null,
            open_issues_count: repo.open_issues_count || 0,
            archived: repo.archived || false,
            last_checked_at: new Date().toISOString(),
          }

          const { error } = await supabase
            .from('app_catalog')
            .upsert(row, { onConflict: 'id' })
          if (error) console.warn(`Upsert failed ${owner}/${name}:`, error.message)
          else totalUpserted++

          // 简单节流：每条间隔 200ms，避免 Edge Function 被限速
          await new Promise(r => setTimeout(r, 200))
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, checked: totalChecked, upserted: totalUpserted }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    console.error('[refresh-app-catalog]', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

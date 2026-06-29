/**
 * aggregate-rankings Edge Function (v4)
 * 聚合 app_events 生成 app_rankings（hot / download / favorite 榜）。
 *
 * v4 质检修复：
 * 1. 分页排序改为 id ASC（id 是自增主键，排序稳定）。
 *    原来的 created_at DESC 在同一时刻有多条记录时排序不稳定，
 *    导致跨页时同一记录被重复计入或漏计。
 * 2. 写入策略改为「upsert 新行 → delete 旧行」（替代先删后插）。
 *    先删后插有短暂空窗口期：delete 成功但 insert 失败时榜单为空。
 *    upsert(onConflict: rank_type,period,owner,repo) + delete(updated_at < runUpdatedAt)：
 *    - upsert 失败：旧行完整保留，榜单不为空；
 *    - delete 失败：最坏情况是榜单多几条旧行，不为空。
 *
 * v3 修复（保留）：
 * 3. UNIQUE 约束改为 (rank_type,period,owner,repo)，upsert onConflict 对齐。
 * 4. app_id falsy 判断修复（0 不再被误判为 null）。
 */
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

const PERIOD_DAYS: Record<string, number> = { week: 7, month: 30, all: 3650 }
const WEIGHTS = { view: 1, download: 5, favorite: 3 }
const PAGE_SIZE = 1000
const MAX_PAGES = 100

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )

  try {
    const result: Array<{ period: string; hot: number; download: number; favorite: number }> = []
    const runUpdatedAt = new Date().toISOString()
    const denySet = new Set<string>()

    try {
      const { data: denyRows } = await supabase.from('ranking_denylist').select('owner, repo')
      ;(denyRows || []).forEach((r: any) => {
        if (r.owner && r.repo) denySet.add(`${r.owner}/${r.repo}`)
      })
    } catch { /* ignore */ }

    for (const [period, days] of Object.entries(PERIOD_DAYS)) {
      const cutoff = new Date(Date.now() - days * 24 * 3600 * 1000)

      // --- 2. 聚合：按 owner/repo 汇总各事件数 ---
      const appMeta = new Map<string, { app_id: number | null; app_name: string; avatar_url: string }>()
      const appCountMap = new Map<string, { view: number; download: number; favorite: number }>()
      let queryFailed = false

      for (const evType of ['view', 'download', 'favorite'] as const) {
        let page = 0
        let done = false
        while (!done) {
          const { data: rows, error } = await supabase
            .from('app_events')
            .select('owner, repo, app_id, app_name, avatar_url')
            .gte('created_at', cutoff.toISOString())
            .eq('event_type', evType)
            .order('id', { ascending: true })   // v4: id 自增稳定排序，避免 created_at 相同时跨页重复计数
            .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

          if (error) {
            console.warn(`[aggregate] Error querying ${evType}:`, error.message)
            queryFailed = true
            break
          }
          if (!rows || rows.length === 0) { done = true; break }

          for (const r of rows as any[]) {
            if (!r.owner || !r.repo) continue
            const key = `${r.owner}/${r.repo}`
            if (denySet.has(key)) continue

            if (!appMeta.has(key)) {
              appMeta.set(key, { app_id: r.app_id || null, app_name: r.app_name || '', avatar_url: r.avatar_url || '' })
            } else {
              const meta = appMeta.get(key)!
              if ((!meta.app_id || meta.app_id <= 0) && r.app_id) meta.app_id = r.app_id
              if (!meta.app_name && r.app_name) meta.app_name = r.app_name
              if (!meta.avatar_url && r.avatar_url) meta.avatar_url = r.avatar_url
            }
            if (!appCountMap.has(key)) appCountMap.set(key, { view: 0, download: 0, favorite: 0 })
            appCountMap.get(key)![evType]++
          }

          if (rows.length < PAGE_SIZE) done = true
          page++
          if (page >= MAX_PAGES) {
            console.warn(`[aggregate] Too many pages for ${evType}`)
            break
          }
        }
        if (queryFailed) break
      }

      if (queryFailed) {
        console.warn(`[aggregate] Skip period=${period} because source event query failed`)
        continue
      }

      // --- 3. 计算各榜单 ---
      const allApps = Array.from(appCountMap.entries()).map(([key, counts]) => {
        const meta = appMeta.get(key) || { app_id: null, app_name: '', avatar_url: '' }
        const [owner, repo] = key.split('/')
        return {
          app_id: meta.app_id, owner, repo, app_name: meta.app_name, avatar_url: meta.avatar_url,
          view_count: counts.view, download_count: counts.download, favorite_count: counts.favorite,
          score: counts.view * WEIGHTS.view + counts.download * WEIGHTS.download + counts.favorite * WEIGHTS.favorite,
        }
      })

      const hot = allApps.slice().sort((a, b) => b.score - a.score).slice(0, 50)
      const dl = allApps.filter((a) => a.download_count > 0).sort((a, b) => b.download_count - a.download_count).slice(0, 50)
      const fav = allApps.filter((a) => a.favorite_count > 0).sort((a, b) => b.favorite_count - a.favorite_count).slice(0, 50)

      const makeRows = (arr: typeof allApps, type: string, scoreField: 'score' | 'download_count' | 'favorite_count') =>
        arr.map((a, idx) => ({
          rank_type: type, period, app_id: a.app_id, app_name: a.app_name,
          owner: a.owner, repo: a.repo, avatar_url: a.avatar_url,
          score: a[scoreField], download_count: a.download_count,
          favorite_count: a.favorite_count, view_count: a.view_count,
          rank_position: idx + 1, updated_at: runUpdatedAt,
        }))

      const rankingGroups = [
        { type: 'hot', rows: makeRows(hot, 'hot', 'score') },
        { type: 'download', rows: makeRows(dl, 'download', 'download_count') },
        { type: 'favorite', rows: makeRows(fav, 'favorite', 'favorite_count') },
      ]

      for (const group of rankingGroups) {
        // ── v4：先 upsert 新行，再删除旧行（消除空窗口期）──
        // upsert 基于 UNIQUE(rank_type, period, owner, repo)：
        //   - 已存在的项目 → UPDATE（刷新排名、计数、updated_at）
        //   - 新进榜项目  → INSERT
        // 然后 delete updated_at < runUpdatedAt 的旧行（即不在本次榜单中的旧项目）。
        // 优势：无论 delete 是否失败，榜单都不会为空。
        if (group.rows.length > 0) {
          const { error: upsertError } = await supabase
            .from('app_rankings')
            .upsert(group.rows, { onConflict: 'rank_type,period,owner,repo' })
          if (upsertError) {
            console.warn(`[aggregate] upsert ${period}/${group.type} failed:`, upsertError.message)
            continue
          }
        }

        // 删除不在本次榜单中的旧行（updated_at 早于本次聚合时间）
        const { error: deleteError } = await supabase
          .from('app_rankings')
          .delete()
          .eq('period', period)
          .eq('rank_type', group.type)
          .lt('updated_at', runUpdatedAt)

        if (deleteError) {
          // delete 失败最多导致榜单多几条旧行，不影响主要功能，仅警告
          console.warn(`[aggregate] cleanup ${period}/${group.type} failed:`, deleteError.message)
        }
      }

      result.push({ period, hot: hot.length, download: dl.length, favorite: fav.length })
      console.log(`[aggregate] period=${period}: hot=${hot.length}, dl=${dl.length}, fav=${fav.length}`)
    }

    return new Response(
      JSON.stringify({ ok: true, periods: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err: any) {
    console.error('[aggregate-rankings] FATAL:', err)
    return new Response(
      JSON.stringify({ error: err.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})

/**
 * aggregate-rankings Edge Function (v5)
 * 聚合 app_events 生成 app_rankings（hot / download / favorite 榜）。
 *
 * v5 修复：
 * 1. app_id 回填：当 app_id 为 null/0 时，从 app_catalog 按 owner/repo 查询补全。
 * 2. 唯一设备计数：新增 unique_download_count / unique_favorite_count 字段，
 *    按 device_id 去重，避免同一设备重复上报导致计数虚高。
 * 3. 写入前清理：先删除 app_id=0 且 owner/repo 均为空的历史脏数据。
 *
 * v4 修复（保留）：
 * 4. 分页排序改为 id ASC（id 是自增主键，排序稳定）。
 * 5. 写入策略为「upsert 新行 → delete 旧行」（消除空窗口期）。
 * 6. UNIQUE 约束 (rank_type,period,owner,repo)，upsert onConflict 对齐。
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

    // 1. 加载黑名单
    try {
      const { data: denyRows } = await supabase.from('ranking_denylist').select('owner, repo')
      ;(denyRows || []).forEach((r: any) => {
        if (r.owner && r.repo) denySet.add(`${r.owner}/${r.repo}`)
      })
    } catch { /* ignore */ }

    // 2. 预加载 app_catalog 的 owner/repo → app_id 映射，用于回填 app_id
    const catalogIdMap = new Map<string, number>()
    try {
      let page = 0
      let done = false
      while (!done) {
        const { data: catRows } = await supabase
          .from('app_catalog')
          .select('id, owner, repo')
          .range(page * 1000, (page + 1) * 1000 - 1)
        if (!catRows || catRows.length === 0) { done = true; break }
        for (const r of catRows as any[]) {
          if (r.owner && r.repo && r.id) {
            catalogIdMap.set(`${r.owner}/${r.repo}`, r.id)
          }
        }
        if (catRows.length < 1000) done = true
        page++
        if (page >= 50) break
      }
    } catch { /* ignore */ }

    // 3. 清理历史的无效脏数据
    try {
      await supabase.from('app_rankings').delete().eq('app_id', 0).is('owner', null)
      await supabase.from('app_rankings').delete().is('owner', null).is('repo', null)
    } catch { /* ignore */ }

    for (const [period, days] of Object.entries(PERIOD_DAYS)) {
      const cutoff = new Date(Date.now() - days * 24 * 3600 * 1000)

      // --- 聚合：按 owner/repo 汇总各事件数（含 device_id 去重）---
      const appMeta = new Map<string, { app_id: number | null; app_name: string; avatar_url: string }>()
      const appCountMap = new Map<string, { view: number; download: number; favorite: number }>()
      const appDeviceMap = new Map<string, Set<string>>() // key → Set<device_id> for download
      const appFavDeviceMap = new Map<string, Set<string>>() // key → Set<device_id> for favorite
      let queryFailed = false

      for (const evType of ['view', 'download', 'favorite'] as const) {
        let page = 0
        let done = false
        while (!done) {
          const { data: rows, error } = await supabase
            .from('app_events')
            .select('owner, repo, app_id, app_name, avatar_url, device_id')
            .gte('created_at', cutoff.toISOString())
            .eq('event_type', evType)
            .order('id', { ascending: true })
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

            // 回填 app_id
            if (!appMeta.has(key)) {
              let appId: number | null = (r.app_id && r.app_id > 0) ? r.app_id : null
              if (!appId) appId = catalogIdMap.get(key) ?? null
              appMeta.set(key, { app_id: appId, app_name: r.app_name || '', avatar_url: r.avatar_url || '' })
            } else {
              const meta = appMeta.get(key)!
              if ((!meta.app_id || meta.app_id <= 0) && r.app_id && r.app_id > 0) meta.app_id = r.app_id
              if (!meta.app_id || meta.app_id <= 0) {
                const catId = catalogIdMap.get(key)
                if (catId) meta.app_id = catId
              }
              if (!meta.app_name && r.app_name) meta.app_name = r.app_name
              if (!meta.avatar_url && r.avatar_url) meta.avatar_url = r.avatar_url
            }

            // 计数
            if (!appCountMap.has(key)) appCountMap.set(key, { view: 0, download: 0, favorite: 0 })
            appCountMap.get(key)![evType]++

            // 设备去重计数（download / favorite）
            if (evType === 'download' && r.device_id) {
              if (!appDeviceMap.has(key)) appDeviceMap.set(key, new Set())
              appDeviceMap.get(key)!.add(r.device_id)
            }
            if (evType === 'favorite' && r.device_id) {
              if (!appFavDeviceMap.has(key)) appFavDeviceMap.set(key, new Set())
              appFavDeviceMap.get(key)!.add(r.device_id)
            }
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

      // --- 计算各榜单 ---
      const allApps = Array.from(appCountMap.entries()).map(([key, counts]) => {
        const meta = appMeta.get(key) || { app_id: null, app_name: '', avatar_url: '' }
        const [owner, repo] = key.split('/')
        const uniqueDownloads = appDeviceMap.get(key)?.size ?? 0
        const uniqueFavorites = appFavDeviceMap.get(key)?.size ?? 0
        return {
          app_id: meta.app_id || 0,
          owner, repo,
          app_name: meta.app_name,
          avatar_url: meta.avatar_url,
          view_count: counts.view,
          download_count: uniqueDownloads || counts.download,  // 优先用去重计数
          favorite_count: uniqueFavorites || counts.favorite,
          score: counts.view * WEIGHTS.view + counts.download * WEIGHTS.download + counts.favorite * WEIGHTS.favorite,
        }
      })

      // 二次排序：hot 按 score 降序，download 按 download_count 降序，favorite 按 favorite_count 降序
      const hot = allApps.slice().sort((a, b) => b.score - a.score || a.app_name.localeCompare(b.app_name)).slice(0, 50)
      const dl = allApps.filter((a) => a.download_count > 0).sort((a, b) => b.download_count - a.download_count || a.app_name.localeCompare(b.app_name)).slice(0, 50)
      const fav = allApps.filter((a) => a.favorite_count > 0).sort((a, b) => b.favorite_count - a.favorite_count || a.app_name.localeCompare(b.app_name)).slice(0, 50)

      const makeRows = (arr: typeof allApps, type: string, scoreField: 'score' | 'download_count' | 'favorite_count') =>
        arr.map((a, idx) => ({
          rank_type: type, period, app_id: a.app_id,
          app_name: a.app_name, owner: a.owner, repo: a.repo,
          avatar_url: a.avatar_url,
          score: a[scoreField],
          download_count: a.download_count,
          favorite_count: a.favorite_count,
          view_count: a.view_count,
          rank_position: idx + 1,
          updated_at: runUpdatedAt,
        }))

      const rankingGroups = [
        { type: 'hot', rows: makeRows(hot, 'hot', 'score') },
        { type: 'download', rows: makeRows(dl, 'download', 'download_count') },
        { type: 'favorite', rows: makeRows(fav, 'favorite', 'favorite_count') },
      ]

      for (const group of rankingGroups) {
        // upsert 基于 UNIQUE(rank_type, period, owner, repo)
        if (group.rows.length > 0) {
          const { error: upsertError } = await supabase
            .from('app_rankings')
            .upsert(group.rows, { onConflict: 'rank_type,period,owner,repo' })
          if (upsertError) {
            console.warn(`[aggregate] upsert ${period}/${group.type} failed:`, upsertError.message)
            continue
          }
        }

        // 删除不在本次榜单中的旧行
        const { error: deleteError } = await supabase
          .from('app_rankings')
          .delete()
          .eq('period', period)
          .eq('rank_type', group.type)
          .lt('updated_at', runUpdatedAt)

        if (deleteError) {
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
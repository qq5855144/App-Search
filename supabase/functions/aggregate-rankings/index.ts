/**
 * aggregate-rankings Edge Function
 * 聚合 app_events 生成排行榜，写入 app_rankings 表。
 * 调用方式：POST（无需 body）或通过 Supabase Cron 定时触发。
 * 也可以前端手动触发刷新。
 */
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

type Period = 'week' | 'month' | 'all'

const PERIOD_INTERVALS: Record<Period, string> = {
  week:  '7 days',
  month: '30 days',
  all:   '3650 days',
}

// 热度分权重
const WEIGHTS = { download: 5, favorite: 3, view: 1 }

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } }
    )

    const periods: Period[] = ['week', 'month', 'all']
    let totalUpserted = 0

    for (const period of periods) {
      const interval = PERIOD_INTERVALS[period]
      const since = `now() - interval '${interval}'`

      // 聚合每个 app 各事件类型的计数
      const { data: aggData, error: aggErr } = await supabase
        .from('app_events')
        .select('app_id, app_name, owner, repo, avatar_url, event_type')
        .gte('created_at', new Date(Date.now() - parseDays(interval) * 86400_000).toISOString())
      if (aggErr) throw aggErr

      // 按 app_id 合并
      type AppStat = {
        app_id: number; app_name: string; owner: string; repo: string; avatar_url: string
        download: number; favorite: number; view: number
      }
      const statsMap = new Map<number, AppStat>()
      for (const row of aggData ?? []) {
        const id = Number(row.app_id)
        if (!statsMap.has(id)) {
          statsMap.set(id, {
            app_id: id, app_name: row.app_name, owner: row.owner,
            repo: row.repo, avatar_url: row.avatar_url,
            download: 0, favorite: 0, view: 0,
          })
        }
        const s = statsMap.get(id)!
        if (row.event_type === 'download') s.download++
        else if (row.event_type === 'favorite') s.favorite++
        else if (row.event_type === 'view') s.view++
      }

      if (statsMap.size === 0) continue

      // 生成综合热度榜（top 50）
      const hotList = Array.from(statsMap.values())
        .map((s) => ({ ...s, score: s.download * WEIGHTS.download + s.favorite * WEIGHTS.favorite + s.view * WEIGHTS.view }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 50)

      const hotRows = hotList.map((s, i) => ({
        rank_type: 'hot', period, app_id: s.app_id, app_name: s.app_name,
        owner: s.owner, repo: s.repo, avatar_url: s.avatar_url,
        score: s.score, download_count: s.download, favorite_count: s.favorite,
        view_count: s.view, rank_position: i + 1, updated_at: new Date().toISOString(),
      }))

      // 下载榜
      const dlList = Array.from(statsMap.values())
        .filter((s) => s.download > 0).sort((a, b) => b.download - a.download).slice(0, 50)
      const dlRows = dlList.map((s, i) => ({
        rank_type: 'download', period, app_id: s.app_id, app_name: s.app_name,
        owner: s.owner, repo: s.repo, avatar_url: s.avatar_url,
        score: s.download, download_count: s.download, favorite_count: s.favorite,
        view_count: s.view, rank_position: i + 1, updated_at: new Date().toISOString(),
      }))

      // 收藏榜
      const favList = Array.from(statsMap.values())
        .filter((s) => s.favorite > 0).sort((a, b) => b.favorite - a.favorite).slice(0, 50)
      const favRows = favList.map((s, i) => ({
        rank_type: 'favorite', period, app_id: s.app_id, app_name: s.app_name,
        owner: s.owner, repo: s.repo, avatar_url: s.avatar_url,
        score: s.favorite, download_count: s.download, favorite_count: s.favorite,
        view_count: s.view, rank_position: i + 1, updated_at: new Date().toISOString(),
      }))

      const allRows = [...hotRows, ...dlRows, ...favRows]

      const { error: upsertErr } = await supabase
        .from('app_rankings')
        .upsert(allRows, { onConflict: 'rank_type,period,app_id' })
      if (upsertErr) throw upsertErr
      totalUpserted += allRows.length
    }

    return new Response(JSON.stringify({ ok: true, upserted: totalUpserted }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    console.error('[aggregate-rankings]', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

function parseDays(interval: string): number {
  const m = interval.match(/(\d+)\s*days?/)
  return m ? Number(m[1]) : 7
}

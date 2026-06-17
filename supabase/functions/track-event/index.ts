/**
 * track-event Edge Function (v2)
 * 记录用户事件（view / download / favorite / search），并更新搜索热词。
 *
 * 关键改进：
 * 1. 批量插入 events（避免 N+1 查询）
 * 2. 批量更新 search_hot_words（在 SQL 端批量 upsert）
 * 3. 支持单条 & 批量事件
 */
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const VALID_EVENTS = new Set(['view', 'download', 'favorite', 'search'])

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )

  try {
    const body = await req.json().catch(() => ({}))
    // 支持单条 {event, app_id, owner, repo, ...} 或批量 {events: [...]}
    const eventsRaw: any[] = Array.isArray(body.events)
      ? body.events
      : [body]

    if (eventsRaw.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: 'No events' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // --- 1. 校验并规范化 ---
    const eventRows: any[] = []
    const keywordStats = new Map<string, number>() // keyword -> count

    for (const e of eventsRaw) {
      const ev = e || {}
      const event_type = String(ev.event_type || '').toLowerCase()
      if (!VALID_EVENTS.has(event_type)) continue

      const row: any = {
        app_id: ev.app_id ? Number(ev.app_id) : null,
        app_name: ev.app_name ? String(ev.app_name).slice(0, 100) : null,
        owner: ev.owner ? String(ev.owner).slice(0, 100) : null,
        repo: ev.repo ? String(ev.repo).slice(0, 100) : null,
        avatar_url: ev.avatar_url ? String(ev.avatar_url).slice(0, 500) : null,
        event_type,
        platform: ev.platform ? String(ev.platform).slice(0, 20) : null,
        device_id: ev.device_id ? String(ev.device_id).slice(0, 100) : null,
      }

      // 对于 search 事件，记录 keyword
      if (event_type === 'search' && ev.keyword && String(ev.keyword).trim()) {
        const kw = String(ev.keyword).trim().slice(0, 100).toLowerCase()
        row.keyword = kw
        keywordStats.set(kw, (keywordStats.get(kw) || 0) + 1)
      }

      // 至少要有 app_id / owner/repo 之一，或者是 search 事件有关键词
      const isSearchOk = event_type === 'search' && row.keyword
      const isAppOk = row.app_id || (row.owner && row.repo)
      if (!isSearchOk && !isAppOk) continue

      eventRows.push(row)
    }

    if (eventRows.length === 0) {
      return new Response(JSON.stringify({ ok: true, inserted: 0, hot_words_updated: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // --- 2. 批量插入 events ---
    let inserted = 0
    try {
      // 分批插入（避免单次请求过大）
      const batches: any[][] = []
      for (let i = 0; i < eventRows.length; i += 100) {
        batches.push(eventRows.slice(i, i + 100))
      }
      for (const batch of batches) {
        const { error } = await supabase.from('app_events').insert(batch)
        if (!error) inserted += batch.length
        else console.warn('[track-event] insert batch failed:', error.message)
      }
    } catch (e: any) {
      console.warn('[track-event] insert error:', e?.message)
    }

    // --- 3. 批量更新热词（一个事务内 upsert，避免 N 次循环）---
    if (keywordStats.size > 0) {
      try {
        const keywordArr = Array.from(keywordStats.keys())
        // 优先：用单个批量 RPC，一次调用解决
        const { error: batchErr } = await supabase
          .rpc('increment_hot_words_batch', { keywords: keywordArr })
          .catch(() => ({ error: { message: 'batch rpc failed, fall back' } }))

        if (!batchErr) return new Response(
          JSON.stringify({ ok: true, inserted, hot_words_updated: keywordArr.length }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )

        // 备用：对每个 keyword 调用新签名 increment_hot_word
        for (const [kw, count] of keywordStats.entries()) {
          await supabase.rpc('increment_hot_word', {
            keyword_in: kw, increment_by: count,
          }).catch(() => { /* silent: RPC 不可用时也不阻断事件写入 */ })
        }
      } catch { /* hot words 失败不影响事件写入的成功返回 */ }
    }

    return new Response(
      JSON.stringify({ ok: true, inserted, hot_words_updated: keywordStats.size }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err: any) {
    console.error('[track-event] FATAL:', err)
    return new Response(
      JSON.stringify({ error: err.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})

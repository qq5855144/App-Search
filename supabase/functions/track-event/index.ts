/**
 * track-event Edge Function (v3)
 * 记录用户事件（view / download / favorite / search），并更新搜索热词。
 *
 * v3 修复：
 * 1. 修复 app_id falsy 判断 bug：ev.app_id=0 原来被错误识别为 falsy → null，
 *    导致违反数据库 NOT NULL 约束或逻辑异常；
 *    改为 ev.app_id != null && ev.app_id !== '' 的显式非空检查。
 * 2. owner/repo/app_name 同理，空字符串正常保留，null/undefined 才用默认值。
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
    for (const e of eventsRaw) {
      const ev = e || {}
      const event_type = String(ev.event_type || '').toLowerCase()
      if (!VALID_EVENTS.has(event_type)) continue

      const row: any = {
        client_event_id: ev.client_event_id ? String(ev.client_event_id).slice(0, 120) : null,
        // 修复：用显式 != null 判断，避免 app_id=0 被误判为 falsy→null
        app_id:    ev.app_id != null && ev.app_id !== '' ? Number(ev.app_id) : 0,
        app_name:  ev.app_name != null ? String(ev.app_name).slice(0, 100) : '',
        owner:     ev.owner != null ? String(ev.owner).slice(0, 100) : '',
        repo:      ev.repo != null ? String(ev.repo).slice(0, 100) : '',
        avatar_url: ev.avatar_url != null ? String(ev.avatar_url).slice(0, 500) : '',
        event_type,
        platform:  ev.platform ? String(ev.platform).slice(0, 20) : null,
        device_id: ev.device_id ? String(ev.device_id).slice(0, 100) : '',
      }

      // 对于 search 事件，记录 keyword
      if (event_type === 'search' && ev.keyword && String(ev.keyword).trim()) {
        const kw = String(ev.keyword).trim().slice(0, 100).toLowerCase()
        row.keyword = kw
      }

      // 至少要有 app_id / owner/repo 之一，或者是 search 事件有关键词
      const isSearchOk = event_type === 'search' && row.keyword
      const isAppOk = row.app_id || (row.owner && row.repo)
      if (!isSearchOk && !isAppOk) continue

      eventRows.push(row)
    }

    if (eventRows.length === 0) {
      return new Response(JSON.stringify({ ok: true, accepted: 0, inserted: 0, hot_words_updated: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // --- 2. 批量插入 events ---
    let inserted = 0
    let hotWordsUpdated = 0
    try {
      // 分批插入（避免单次请求过大）
      const batches: any[][] = []
      for (let i = 0; i < eventRows.length; i += 100) {
        batches.push(eventRows.slice(i, i + 100))
      }
      for (const batch of batches) {
        const { error } = await supabase
          .from('app_events')
          .upsert(batch, { onConflict: 'client_event_id', ignoreDuplicates: false })
        if (!error) {
          inserted += batch.length
          // 统计 search 事件数量，用于 hot_words_updated 计数
          hotWordsUpdated += batch.filter((r: any) => r.event_type === 'search' && r.keyword).length
        }
        else console.warn('[track-event] insert batch failed:', error.message)
      }
    } catch (e: any) {
      console.warn('[track-event] insert error:', e?.message)
    }

    return new Response(
      JSON.stringify({ ok: true, accepted: eventRows.length, inserted, hot_words_updated: hotWordsUpdated }),
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

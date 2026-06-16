/**
 * track-event Edge Function
 * 接收前端埋点事件，批量写入 app_events 表，
 * 同时维护 search_hot_words 热词计数。
 */
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } }
    )

    const body = await req.json()

    // 支持单条或批量：{ events: [...] } 或单个事件对象
    const rawEvents: any[] = Array.isArray(body.events) ? body.events : [body]

    if (rawEvents.length === 0) {
      return new Response(JSON.stringify({ ok: true, inserted: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 清洗字段，防止客户端注入多余列
    const rows = rawEvents.map((e: any) => ({
      app_id:     Number(e.app_id ?? 0),
      app_name:   String(e.app_name ?? '').slice(0, 200),
      owner:      String(e.owner ?? '').slice(0, 100),
      repo:       String(e.repo ?? '').slice(0, 100),
      avatar_url: String(e.avatar_url ?? '').slice(0, 500),
      event_type: e.event_type,
      keyword:    e.keyword ? String(e.keyword).slice(0, 100) : null,
      platform:   e.platform ? String(e.platform).slice(0, 50) : null,
      device_id:  String(e.device_id ?? '').slice(0, 64),
    })).filter((r) =>
      ['search', 'view', 'download', 'favorite'].includes(r.event_type)
    )

    if (rows.length === 0) {
      return new Response(JSON.stringify({ ok: true, inserted: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 写入事件
    const { error: insertErr } = await supabase.from('app_events').insert(rows)
    if (insertErr) throw insertErr

    // 更新搜索热词
    const searchRows = rows.filter((r) => r.event_type === 'search' && r.keyword)
    for (const r of searchRows) {
      await supabase.rpc('increment_hot_word', { kw: r.keyword })
    }

    return new Response(JSON.stringify({ ok: true, inserted: rows.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    console.error('[track-event]', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

/**
 * search-catalog Edge Function
 * 客户端统一查询接口，从 app_catalog 表返回预处理好的应用列表。
 * 支持：平台过滤、分类(topic)过滤、排序、分页、全文搜索。
 */
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const {
      platform,    // 'Android' | 'iOS' | 'Windows' | 'macOS' | 'Linux' | '全平台'
      topic,       // topic 关键词，如 'developer-tools' | 'productivity' | ''
      sort = 'stars',  // 'stars' | 'updated' | 'forks' | 'downloads'
      page = 1,
      per_page = 20,
      q = '',      // 全文搜索词
    } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } }
    )

    const offset = (page - 1) * per_page

    let query = supabase
      .from('app_catalog')
      .select('*', { count: 'exact' })
      .eq('archived', false)

    // 平台过滤
    if (platform && platform !== '全平台') {
      query = query.contains('platforms', [platform])
    }

    // 分类（topic）过滤
    if (topic) {
      query = query.contains('topics', [topic])
    }

    // 全文搜索
    if (q && q.trim()) {
      query = query.or(
        `name.ilike.%${q}%,description.ilike.%${q}%,owner.ilike.%${q}%`
      )
    }

    // 排序
    const sortMap: Record<string, { column: string; ascending: boolean }> = {
      stars:     { column: 'stars',              ascending: false },
      updated:   { column: 'updated_at',         ascending: false },
      forks:     { column: 'forks',              ascending: false },
      downloads: { column: 'total_downloads',    ascending: false },
    }
    const { column, ascending } = sortMap[sort] || sortMap.stars
    query = query.order(column, { ascending })

    // 分页
    query = query.range(offset, offset + per_page - 1)

    const { data, error, count } = await query
    if (error) throw error

    return new Response(JSON.stringify({ data: data || [], total_count: count || 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    console.error('[search-catalog]', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

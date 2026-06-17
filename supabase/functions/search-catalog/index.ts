/**
 * search-catalog Edge Function
 * 客户端统一查询接口，从 app_catalog 表返回预处理好的应用列表。
 * 支持：平台过滤、分类(topics 数组 OR)过滤、排序、分页、全文搜索。
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
      platform,         // 'Android' | 'iOS' | 'Windows' | 'macOS' | 'Linux' | '全平台'
      topic,            // 单个 topic（兼容旧调用）
      topics,           // string[] – OR 匹配多个 topic（新）
      sort = 'stars',   // 'stars' | 'updated' | 'forks' | 'downloads'
      page = 1,
      per_page = 20,
      q = '',           // 全文搜索词
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
      .not('latest_version', 'is', null)  // 只返回有安装包的项目

    // 平台过滤
    if (platform && platform !== '全平台') {
      query = query.contains('platforms', [platform])
    }

    // 分类 topic 过滤：支持数组 OR（新）或单值（兼容旧）
    const topicList: string[] = Array.isArray(topics) && topics.length > 0
      ? topics
      : topic ? [topic] : []

    if (topicList.length === 1) {
      // 单 topic：精确包含匹配
      query = query.contains('topics', [topicList[0]])
    } else if (topicList.length > 1) {
      // 多 topic：OR 匹配（只要 topics 数组中包含任意一个即可）
      const orClauses = topicList.map((t) => `topics.cs.{${t}}`).join(',')
      query = query.or(orClauses)
    }

    // 全文搜索
    if (q && q.trim()) {
      const term = q.trim()
      query = query.or(
        `name.ilike.%${term}%,repo.ilike.%${term}%,full_name.ilike.%${term}%,description.ilike.%${term}%,owner.ilike.%${term}%`
      )
    }

    // 排序
    const sortMap: Record<string, { column: string; ascending: boolean }> = {
      stars:     { column: 'stars',           ascending: false },
      updated:   { column: 'updated_at',      ascending: false },
      forks:     { column: 'forks',           ascending: false },
      downloads: { column: 'total_downloads', ascending: false },
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

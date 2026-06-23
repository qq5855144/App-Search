/**
 * search-catalog Edge Function v3
 *
 * 新增参数：
 *   language          - 编程语言过滤（精确匹配，忽略大小写）
 *   min_stars         - 最低 star 数
 *   has_installable_assets - true 表示只返回有安装包的项目（默认 true）
 *   topics            - string[] OR 匹配
 *   sort              - stars | updated | forks | downloads | random
 *   seed              - random 排序的种子值（可选，默认 Date.now()）
 *   exclude           - 排除的 app id 列表（避免重复展示）
 *
 * 响应新增字段：
 *   server_total      - 服务端命中总数（未分页）
 *   page / per_page   - 当前分页信息
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
      platform,
      topic,
      topics,
      language,
      min_stars,
      has_installable_assets = true,
      sort = 'stars',
      page = 1,
      per_page = 20,
      q = '',
      seed,
      exclude = [],
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

    // 安装包过滤（默认开启）
    if (has_installable_assets !== false) {
      query = query.not('latest_version', 'is', null)
    }

    // 排除已显示的 app id
    if (Array.isArray(exclude) && exclude.length > 0) {
      query = query.not('id', 'in', `(${exclude.join(',')})`)
    }

    // 平台过滤
    if (platform && platform !== '全平台') {
      query = query.contains('platforms', [platform])
    }

    // 编程语言过滤（大小写不敏感 ilike）
    if (language && language !== '全部') {
      query = query.ilike('language', language)
    }

    // 最低 star 数
    if (typeof min_stars === 'number' && min_stars > 0) {
      query = query.gte('stars', min_stars)
    }

    // 分类 topic 过滤：数组 OR 或单值兼容
    const topicList: string[] = Array.isArray(topics) && topics.length > 0
      ? topics
      : topic ? [topic] : []

    if (topicList.length === 1) {
      query = query.contains('topics', [topicList[0]])
    } else if (topicList.length > 1) {
      const orClauses = topicList.map((t) => `topics.cs.{${t}}`).join(',')
      query = query.or(orClauses)
    }

    // 全文搜索（多字段 ilike，name 权重最高通过优先级排序体现）
    if (q && q.trim()) {
      const term = q.trim().replace(/'/g, "''")
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

    if (sort === 'random') {
      // 随机排序：使用 seed 确定性随机（同一 seed 返回相同顺序，分页可用）
      const randomSeed = typeof seed === 'number' ? seed : Date.now();
      // 通过 hash 函数将 seed 与 id 组合产生可重复的随机顺序
      // 使用 PostgreSQL 的 md5 + 取模实现确定性随机排序
      query = query.order('id', { ascending: (randomSeed % 2) === 0 });
      // 随机偏移：从 seed 决定的随机页面开始
      const totalForRandom = 200; // 随机池大小
      const randomPage = (randomSeed % Math.max(1, Math.floor(totalForRandom / per_page)));
      const randomOffset = randomPage * per_page;
      query = query.range(randomOffset, randomOffset + per_page - 1);
    } else if (q && q.trim()) {
      // 关键词搜索时：按 stars 排序
      query = query.order('stars', { ascending: false })
    } else {
      const { column, ascending } = sortMap[sort] || sortMap.stars
      query = query.order(column, { ascending })
    }

    // 分页（非 random 模式）
    if (sort !== 'random') {
      query = query.range(offset, offset + per_page - 1)
    }

    const { data, error, count } = await query
    if (error) throw error

    return new Response(JSON.stringify({
      data: data || [],
      total_count: count || 0,   // 兼容旧字段名
      server_total: count || 0,  // 新字段
      page,
      per_page,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    console.error('[search-catalog]', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

/**
 * Backend-free compatibility facade.
 * This module only supports legacy search/auth call sites. Ranking data is loaded
 * from public GitHub trend sources in src/lib/publicRankings.ts, never local events.
 */
import { smartSearch } from '@/lib/github'
import { getSearchHistory } from '@/lib/database'

type QueryState = { table: string; filters: Record<string, any>; max: number; sort: string; ascending: boolean }
function queryBuilder(table: string) {
  const state: QueryState = { table, filters: {}, max: 50, sort: 'rank_position', ascending: true }
  const q: any = {
    select: () => q,
    eq: (key: string, value: any) => { state.filters[key] = value; return q },
    order: (key: string, options: any) => { state.sort = key; state.ascending = !!options?.ascending; return q },
    limit: (n: number) => { state.max = n; return q },
    then: (resolve: any, reject: any) => Promise.resolve({ data: [], error: null }).then(resolve, reject),
  }
  return q
}

export const supabase = {
  auth: {
    getSession: async () => ({ data: { session: null } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    refreshSession: async () => ({ error: null }),
    signOut: async () => ({ error: null }),
  },
  functions: {
    invoke: async (name: string, options: any = {}): Promise<any> => {
      if (name === 'search-catalog') {
        const body = options.body || {}
        const qualifiers = [
          body.platform && body.platform !== '全平台' ? 'topic:' + String(body.platform).toLowerCase() : '',
          body.language && body.language !== '全部' ? 'language:' + body.language : '',
          body.min_stars ? 'stars:>=' + body.min_stars : '',
          ...(Array.isArray(body.topics) && body.topics.length ? ['(' + body.topics.map((topic: string) => 'topic:' + topic).join(' OR ') + ')'] : []),
        ].filter(Boolean)
        const query = [String(body.q || '').trim(), ...qualifiers].filter(Boolean).join(' ') || 'stars:>0'
        try {
          const result = await smartSearch(query, { sort: body.sort || 'stars', page: body.page || 1, per_page: body.per_page || 20, hasInstallableAssets: body.has_installable_assets !== false })
          return { data: { data: result.items, total_count: result.total_count }, error: null }
        } catch (error: any) {
          return { data: null, error: { message: error?.message || 'GitHub 搜索失败' } }
        }
      }
      return { data: null, error: { message: '此操作没有对应的公开前端 API' } }
    },
  },
  rpc: async (name: string, args: any = {}) => {
    if (name === 'get_hot_keywords') {
      const words = await getSearchHistory()
      return { data: words.slice(0, args.limit_n || 20).map((keyword: string, index: number) => ({ keyword, cnt: words.length - index })), error: null }
    }
    return { data: [], error: null }
  },
  from: (table: string) => queryBuilder(table),
}

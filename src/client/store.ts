import type { AppItem } from '@/types'
import { searchRepos, fetchRepoDetail } from '@/lib/github'
import { getSearchHistory } from '@/lib/database'

let hotCache: { words: string[]; at: number } | null = null
const HOT_CACHE_TTL = 5 * 60 * 1000

export async function getHotWords(limit = 20): Promise<string[]> {
  if (hotCache && Date.now() - hotCache.at < HOT_CACHE_TTL) return hotCache.words.slice(0, limit)
  const history = await getSearchHistory()
  const words = [...new Set(history.map(v => v.trim()).filter(v => v.length >= 2 && v.length <= 50))]
  hotCache = { words, at: Date.now() }
  return words.slice(0, limit)
}
export function clearHotWordsCache() { hotCache = null }

export interface CatalogQuery {
  platform?: string; topic?: string; topics?: string[]; language?: string; min_stars?: number
  has_installable_assets?: boolean; sort?: 'stars' | 'updated' | 'forks' | 'downloads'
  page?: number; per_page?: number; q?: string
}
export interface CatalogResult { items: AppItem[]; total_count: number; server_total?: number; error?: string }

export async function queryCatalog(opts: CatalogQuery): Promise<CatalogResult> {
  const qualifiers = [
    opts.platform && opts.platform !== '全平台' ? `topic:${opts.platform.toLowerCase()}` : '',
    opts.language && opts.language !== '全部' ? `language:${opts.language}` : '',
    opts.min_stars ? `stars:>=${opts.min_stars}` : '',
    ...(opts.topics || (opts.topic ? [opts.topic] : [])).map(t => `topic:${t}`),
  ].filter(Boolean)
  const q = [opts.q?.trim(), ...qualifiers].filter(Boolean).join(' ') || 'stars:>0'
  try {
    const result = await searchRepos(q, { sort: opts.sort || 'stars', page: opts.page || 1, per_page: opts.per_page || 20, installableOnly: opts.has_installable_assets !== false })
    return { ...result, server_total: result.total_count }
  } catch (e: any) { return { items: [], total_count: 0, error: e?.message || 'GitHub 搜索失败' } }
}
export async function getPopularApps(limit = 20) { return queryCatalog({ sort: 'stars', page: 1, per_page: limit }) }
export async function getLatestApps(limit = 20) { return queryCatalog({ sort: 'updated', page: 1, per_page: limit }) }
export async function searchApps(keyword: string, limit = 30) { return queryCatalog({ q: keyword, page: 1, per_page: limit }) }
export async function getCatalogCount(): Promise<number> { return 0 }
export async function getPlatformList(): Promise<string[]> { return ['Android','iOS','Windows','macOS','Linux'] }
export async function getTopicList(): Promise<string[]> { return [] }
export async function getAppByOwnerRepo(owner: string, repo: string): Promise<AppItem | null> {
  try { return await fetchRepoDetail(owner, repo) } catch { return null }
}
export async function getAppById(_id: number): Promise<AppItem | null> { return null }

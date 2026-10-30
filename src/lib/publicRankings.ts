import type { AppItem } from '@/types'
import { searchRepos } from '@/lib/github'

export type PublicRankType = 'trending' | 'growth' | 'popular'
export type PublicRankPeriod = 'week' | 'month' | 'all'

export interface PublicRankItem {
  app_id: number
  app_name: string
  owner: string
  repo: string
  avatar_url: string
  description: string
  language: string
  score: number
  stars: number
  forks: number
  rank_position: number
  updated_at: string
  source: string
  html_url: string
}

type GitStockItem = {
  rank?: number; owner: string; repo: string; description?: string
  language?: string; stars?: number; forks?: number; stars_gained?: number
  captured_at?: number; github_url?: string
}

const CACHE_TTL = 15 * 60 * 1000
const cache = new Map<string, { at: number; items: PublicRankItem[] }>()
const numberValue = (value: unknown) => {
  const n = typeof value === 'number' ? value : Number(value || 0)
  return Number.isFinite(n) ? n : 0
}

function fromGitStock(item: GitStockItem, index: number, capturedAt: string): PublicRankItem {
  const owner = String(item.owner || '')
  const repo = String(item.repo || '')
  return {
    app_id: 0, app_name: repo || owner, owner, repo,
    avatar_url: owner ? `https://github.com/${owner}.png` : '',
    description: item.description || '', language: item.language || '',
    score: numberValue(item.stars_gained), stars: numberValue(item.stars),
    forks: numberValue(item.forks), rank_position: numberValue(item.rank) || index + 1,
    updated_at: item.captured_at ? new Date(item.captured_at * 1000).toISOString() : capturedAt,
    source: 'GitStock · GitHub Trending 快照',
    html_url: item.github_url || `https://github.com/${owner}/${repo}`,
  }
}

async function fetchGitStock(period: 'daily' | 'weekly' | 'monthly'): Promise<PublicRankItem[]> {
  const response = await fetch(`https://gitstock.org/api/v1/github/trending?period=${period}&description_lang=zh`, {
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) throw new Error(`GitStock 公共趋势接口暂不可用（HTTP ${response.status}）`)
  const payload = await response.json()
  if (!Array.isArray(payload?.items)) throw new Error('GitStock 返回的数据格式无效')
  const capturedAt = payload.date ? new Date(`${payload.date}T23:59:59Z`).toISOString() : new Date().toISOString()
  return payload.items
    .filter((item: GitStockItem) => item?.owner && item?.repo)
    .map((item: GitStockItem, index: number) => fromGitStock(item, index, capturedAt))
}

async function fetchOssInsight(period: 'past_24_hours' | 'past_week' | 'past_month'): Promise<PublicRankItem[]> {
  const url = `https://api.ossinsight.io/v1/trends/repos/?period=${period}&language=All`
  const response = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`OSS Insight 公共趋势接口暂不可用（HTTP ${response.status}）`)
  const payload = await response.json()
  const rows = payload?.data?.rows
  if (!Array.isArray(rows)) throw new Error('OSS Insight 返回的数据格式无效')
  return rows.map((row: any, index: number) => {
    const fullName = String(row.repo_name || row.full_name || '')
    const [owner, ...repoParts] = fullName.split('/')
    const repo = repoParts.join('/')
    const stars = numberValue(row.stars)
    return {
      app_id: 0, app_name: repo || fullName, owner: owner || '', repo,
      avatar_url: owner ? `https://github.com/${owner}.png` : '',
      description: row.description || '', language: row.primary_language || '',
      score: stars, stars, forks: numberValue(row.forks), rank_position: index + 1,
      updated_at: new Date().toISOString(), source: 'OSS Insight · GitHub 事件分析',
      html_url: owner && repo ? `https://github.com/${owner}/${repo}` : `https://github.com/${fullName}`,
    } satisfies PublicRankItem
  }).filter((item: PublicRankItem) => item.owner && item.repo)
}

function fromApp(item: AppItem, index: number): PublicRankItem {
  return {
    app_id: item.id, app_name: item.name || item.repo, owner: item.owner, repo: item.repo,
    avatar_url: item.avatar_url, description: item.description || '', language: item.language || '',
    score: item.stars, stars: item.stars, forks: item.forks, rank_position: index + 1,
    updated_at: item.updated_at, source: 'GitHub 官方 Search API · Stars 总量',
    html_url: item.html_url,
  }
}

export async function fetchPublicRankings(type: PublicRankType, period: PublicRankPeriod, force = false): Promise<PublicRankItem[]> {
  const key = `${type}:${period}`
  const cached = cache.get(key)
  if (!force && cached && Date.now() - cached.at < CACHE_TTL) return cached.items

  let items: PublicRankItem[]
  if (type === 'popular') {
    const result = await searchRepos('stars:>100', { sort: 'stars', order: 'desc', page: 1, per_page: 50, installableOnly: false })
    items = result.items.map(fromApp)
  } else if (type === 'growth') {
    const gitStockPeriod = period === 'week' ? 'weekly' : period === 'month' ? 'monthly' : 'daily'
    items = await fetchGitStock(gitStockPeriod)
    items = items.sort((a, b) => b.score - a.score).map((item, index) => ({ ...item, rank_position: index + 1 }))
  } else {
    const gitStockPeriod = period === 'week' ? 'weekly' : period === 'month' ? 'monthly' : 'daily'
    try {
      items = await fetchGitStock(gitStockPeriod)
    } catch (primaryError) {
      try {
        const ossPeriod = period === 'week' ? 'past_week' : period === 'month' ? 'past_month' : 'past_24_hours'
        items = await fetchOssInsight(ossPeriod)
      } catch {
        throw primaryError
      }
    }
  }
  items = items.slice(0, 50).map((item, index) => ({ ...item, rank_position: index + 1 }))
  cache.set(key, { at: Date.now(), items })
  return items
}

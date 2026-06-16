import { supabase } from '@/client/supabase'
import type { AppItem, GitHubRelease } from '@/types'

let cachedToken: string | null = null

export async function setGitHubToken(token: string | null) {
  cachedToken = token
}

export async function getGitHubToken(): Promise<string | null> {
  return cachedToken
}

/** 从 supabase.functions.invoke 的 error 中提取可读错误信息 */
async function extractErrorMessage(error: any): Promise<string> {
  try {
    const raw = await error?.context?.text?.()
    if (raw) {
      const parsed = JSON.parse(raw)
      // Edge Function 返回: { error, details } 或 { message }
      if (parsed?.details) return String(parsed.details)
      if (parsed?.error) return String(parsed.error)
      if (parsed?.message) return String(parsed.message)
      return raw
    }
  } catch { /* ignore parse errors */ }
  return error?.message || '请求失败，请稍后重试'
}

export async function searchRepos(
  q: string,
  options: { sort?: string; order?: string; page?: number; per_page?: number } = {}
): Promise<{ items: AppItem[]; total_count: number }> {
  const { data, error } = await supabase.functions.invoke('github-proxy', {
    body: {
      action: 'search',
      params: { q, sort: options.sort || 'stars', order: options.order || 'desc', page: options.page || 1, per_page: options.per_page || 30 },
      token: cachedToken,
    },
  })
  if (error) {
    const msg = await extractErrorMessage(error)
    throw new Error(msg)
  }
  const items = (data.data?.items || []).map((item: any) => mapRepoToApp(item))
  return { items, total_count: data.data?.total_count || 0 }
}

export async function fetchRepoDetail(owner: string, repo: string): Promise<AppItem> {
  const { data, error } = await supabase.functions.invoke('github-proxy', {
    body: {
      action: 'repo',
      params: { owner, repo },
      token: cachedToken,
    },
  })
  if (error) {
    const msg = await extractErrorMessage(error)
    throw new Error(msg)
  }
  return mapRepoToApp(data.data)
}

export async function fetchReleases(owner: string, repo: string, page = 1): Promise<GitHubRelease[]> {
  const { data, error } = await supabase.functions.invoke('github-proxy', {
    body: {
      action: 'releases',
      params: { owner, repo, page },
      token: cachedToken,
    },
  })
  if (error) {
    const msg = await extractErrorMessage(error)
    throw new Error(msg)
  }
  return (data.data || []).map((r: any) => ({
    id: r.id,
    tag_name: r.tag_name,
    name: r.name || r.tag_name,
    body: r.body,
    published_at: r.published_at,
    html_url: r.html_url,
    assets: (r.assets || []).map((a: any) => ({
      name: a.name,
      size: a.size,
      download_count: a.download_count || 0,
      browser_download_url: a.browser_download_url,
    })),
  }))
}

export async function fetchReadme(owner: string, repo: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('github-proxy', {
    body: {
      action: 'readme',
      params: { owner, repo },
      token: cachedToken,
    },
  })
  if (error) {
    const msg = await extractErrorMessage(error)
    throw new Error(msg)
  }
  // GitHub API 返回的 base64 中含 `\n`，必须先清除再 atob
  const raw = (data.data?.content || '').replace(/\s/g, '')
  if (!raw) return ''
  try {
    // 优先使用 TextDecoder 正确处理多字节 UTF-8 字符（中文、emoji 等）
    const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0))
    return new TextDecoder().decode(bytes)
  } catch {
    try {
      // 降级方案：旧浏览器 / 纯 ASCII README
      return decodeURIComponent(escape(atob(raw)))
    } catch {
      return ''
    }
  }
}

export async function fetchContributors(owner: string, repo: string): Promise<Array<{ login: string; avatar_url: string; html_url: string }>> {
  const { data, error } = await supabase.functions.invoke('github-proxy', {
    body: {
      action: 'contributors',
      params: { owner, repo },
      token: cachedToken,
    },
  })
  if (error) {
    const msg = await extractErrorMessage(error)
    throw new Error(msg)
  }
  return (data.data || []).map((c: any) => ({
    login: c.login,
    avatar_url: c.avatar_url,
    html_url: c.html_url,
  }))
}

export async function fetchRateLimit(): Promise<{ remaining: number; limit: number; reset: number }> {
  const { data, error } = await supabase.functions.invoke('github-proxy', {
    body: {
      action: 'rate_limit',
      token: cachedToken,
    },
  })
  if (error) {
    const msg = await extractErrorMessage(error)
    throw new Error(msg)
  }
  const core = data.data?.resources?.core || data.data?.rate || { remaining: 0, limit: 60, reset: 0 }
  return {
    remaining: core.remaining ?? 0,
    limit: core.limit ?? 60,
    reset: core.reset ?? 0,
  }
}

function mapRepoToApp(item: any): AppItem {
  const platforms = detectPlatforms(item.topics || [])
  return {
    id: item.id,
    full_name: item.full_name,
    name: item.name,
    description: item.description,
    owner: item.owner?.login || '',
    repo: item.name,
    avatar_url: item.owner?.avatar_url || '',
    stars: item.stargazers_count || 0,
    forks: item.forks_count || 0,
    language: item.language,
    topics: item.topics || [],
    platforms,
    latest_version: null,
    latest_release_date: null,
    html_url: item.html_url,
    updated_at: item.updated_at || item.pushed_at,
    license: item.license?.name || item.license?.spdx_id || null,
  }
}

function detectPlatforms(topics: string[]): string[] {
  const map: Record<string, string> = {
    'android-app': 'Android',
    'android': 'Android',
    'ios-app': 'iOS',
    'ios': 'iOS',
    'macos': 'macOS',
    'macos-app': 'macOS',
    'windows': 'Windows',
    'windows-app': 'Windows',
    'linux': 'Linux',
    'linux-app': 'Linux',
    'electron': 'Windows',
    'cross-platform': 'Android',
  }
  const platforms = new Set<string>()
  for (const topic of topics) {
    const lower = topic.toLowerCase()
    if (map[lower]) platforms.add(map[lower])
  }
  return Array.from(platforms)
}

export function getPlatformFromFilename(filename: string): string | null {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.apk')) return 'Android'
  if (lower.endsWith('.ipa')) return 'iOS'
  if (lower.endsWith('.dmg')) return 'macOS'
  if (lower.endsWith('.exe') || lower.endsWith('.msi')) return 'Windows'
  if (lower.endsWith('.deb') || lower.endsWith('.rpm') || lower.endsWith('.appimage')) return 'Linux'
  return null
}

export function filterInstallAssets(assets: GitHubRelease['assets']) {
  const sigExts = ['.asc', '.sig', '.sha256', '.sha512', '.md5', '.txt']
  return assets.filter((a) => {
    const lower = a.name.toLowerCase()
    return !sigExts.some((ext) => lower.endsWith(ext))
  })
}

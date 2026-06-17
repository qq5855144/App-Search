import { supabase } from './supabase';
import type { AppItem } from '@/types';

/**
 * 将数据库行转换为 AppItem
 * 统一转换逻辑，消除各页面的重复代码
 */
function rowToAppItem(r: any): AppItem {
  if (!r) return {} as AppItem;
  return {
    id: r.id,
    full_name: r.full_name,
    name: r.name,
    description: r.description,
    owner: r.owner,
    repo: r.repo,
    avatar_url: r.avatar_url || '',
    stars: r.stars || 0,
    forks: r.forks || 0,
    language: r.language,
    topics: r.topics || [],
    platforms: r.platforms || [],
    latest_version: r.latest_version,
    latest_release_date: r.latest_release_date,
    html_url: r.html_url || `https://github.com/${r.owner}/${r.repo}`,
    updated_at: r.updated_at || '',
    license: r.license,
    archived: r.archived || false,
    open_issues_count: r.open_issues_count || 0,
    total_downloads: r.total_downloads || 0,
    has_installable_assets: true,
  };
}

/**
 * 查询参数（统一接口）
 */
export interface CatalogQuery {
  platform?: string;      // 'Android' | 'iOS' | 'Windows' | 'macOS' | 'Linux'
  topic?: string;         // topic 关键词，如 'developer-tools'
  sort?: 'stars' | 'updated' | 'forks' | 'downloads';
  page?: number;
  per_page?: number;
  q?: string;             // 全文搜索词
}

export interface CatalogResult {
  items: AppItem[];
  total_count: number;
  error?: string;
}

/**
 * 核心：从 app_catalog 查询应用列表
 * 
 * 特点：
 * 1. 统一查询入口，所有页面共用
 * 2. 只返回有安装包的项目 (latest_version IS NOT NULL)
 * 3. 过滤已归档项目
 * 4. 添加调试日志便于排查
 */
export async function queryCatalog(opts: CatalogQuery): Promise<CatalogResult> {
  const {
    platform,
    topic,
    sort = 'stars',
    page = 1,
    per_page = 20,
    q = '',
  } = opts;

  const offset = (page - 1) * per_page;

  console.log('[Catalog] Query:', { platform, topic, sort, page, q: q || '(none)' });

  // === 1. 基础查询：只查有安装包的项目 ===
  let query = supabase
    .from('app_catalog')
    .select('*', { count: 'exact' })
    .not('latest_version', 'is', null)  // 必须有安装包
    .eq('archived', false);              // 不展示归档项目

  // === 2. 平台过滤 ===
  if (platform && platform !== '全平台') {
    query = query.contains('platforms', [platform]);
  }

  // === 3. Topic 过滤 ===
  if (topic) {
    query = query.contains('topics', [topic]);
  }

  // === 4. 全文搜索（关键词匹配 name / repo / full_name / description / owner）===
  if (q && q.trim()) {
    const term = q.trim();
    // 使用 OR 进行多字段模糊匹配
    // Supabase postgREST 的 or 语法：
    // .or('col1.ilike.%term%,col2.ilike.%term%')
    const safeTerm = term.replace(/'/g, "''");
    query = query.or(
      `name.ilike.%${safeTerm}%,repo.ilike.%${safeTerm}%,full_name.ilike.%${safeTerm}%,description.ilike.%${safeTerm}%,owner.ilike.%${safeTerm}%`
    );
  }

  // === 5. 排序 ===
  const sortMap: Record<string, string> = {
    stars: 'stars',
    updated: 'updated_at',
    forks: 'forks',
    downloads: 'total_downloads',
  };
  const sortCol = sortMap[sort] || 'stars';
  query = query.order(sortCol, { ascending: false });

  // === 6. 分页 ===
  query = query.range(offset, offset + per_page - 1);

  // === 7. 执行 ===
  try {
    const { data, error, count } = await query;

    if (error) {
      console.error('[Catalog] Query ERROR:', error.message, error.code);
      return { items: [], total_count: 0, error: error.message };
    }

    const items = (data || []).map(rowToAppItem);
    console.log('[Catalog] Returned:', items.length, '/ total:', count);
    return { items, total_count: count || 0 };
  } catch (e: any) {
    console.error('[Catalog] Unexpected ERROR:', e?.message || e);
    return { items: [], total_count: 0, error: e?.message || '查询失败' };
  }
}

/**
 * 便捷函数：获取热门应用
 */
export async function getPopularApps(limit = 20): Promise<CatalogResult> {
  return queryCatalog({ sort: 'stars', page: 1, per_page: limit });
}

/**
 * 便捷函数：获取最新更新的应用
 */
export async function getLatestApps(limit = 20): Promise<CatalogResult> {
  return queryCatalog({ sort: 'updated', page: 1, per_page: limit });
}

/**
 * 便捷函数：全文搜索
 */
export async function searchApps(keyword: string, limit = 30): Promise<CatalogResult> {
  return queryCatalog({ q: keyword, page: 1, per_page: limit });
}

/**
 * 获取应用总数（用于显示统计信息）
 */
export async function getCatalogCount(): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('app_catalog')
      .select('*', { count: 'exact', head: true })
      .not('latest_version', 'is', null)
      .eq('archived', false);

    if (error) {
      console.error('[Catalog] Count ERROR:', error.message);
      return 0;
    }
    return count || 0;
  } catch {
    return 0;
  }
}

/**
 * 获取所有唯一的平台列表
 */
export async function getPlatformList(): Promise<string[]> {
  try {
    const { data } = await supabase
      .from('app_catalog')
      .select('platforms')
      .not('latest_version', 'is', null)
      .eq('archived', false);

    const allPlatforms = new Set<string>();
    (data || []).forEach((row: any) => {
      (row.platforms || []).forEach((p: string) => allPlatforms.add(p));
    });
    return Array.from(allPlatforms).sort();
  } catch {
    return [];
  }
}

/**
 * 获取所有唯一的 topic 列表
 */
export async function getTopicList(): Promise<string[]> {
  try {
    const { data } = await supabase
      .from('app_catalog')
      .select('topics')
      .not('latest_version', 'is', null)
      .eq('archived', false);

    const allTopics = new Set<string>();
    (data || []).forEach((row: any) => {
      (row.topics || []).forEach((t: string) => allTopics.add(t));
    });
    return Array.from(allTopics).sort();
  } catch {
    return [];
  }
}

/**
 * 通过 owner/repo 获取单个应用详情
 */
export async function getAppByOwnerRepo(owner: string, repo: string): Promise<AppItem | null> {
  try {
    const { data } = await supabase
      .from('app_catalog')
      .select('*')
      .eq('owner', owner)
      .eq('repo', repo)
      .limit(1);

    if (!data || data.length === 0) return null;
    return rowToAppItem(data[0]);
  } catch (e: any) {
    console.error('[Catalog] getAppByOwnerRepo ERROR:', e?.message);
    return null;
  }
}

/**
 * 通过 id 获取单个应用详情
 */
export async function getAppById(id: number): Promise<AppItem | null> {
  try {
    const { data } = await supabase
      .from('app_catalog')
      .select('*')
      .eq('id', id)
      .limit(1);

    if (!data || data.length === 0) return null;
    return rowToAppItem(data[0]);
  } catch (e: any) {
    console.error('[Catalog] getAppById ERROR:', e?.message);
    return null;
  }
}

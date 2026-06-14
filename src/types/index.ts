export interface GitHubRepo {
  id: number;
  full_name: string;
  name: string;
  description: string | null;
  owner: {
    login: string;
    avatar_url: string;
  };
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  topics: string[];
  html_url: string;
  created_at: string;
  updated_at: string;
  pushed_at: string;
}

export interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string;
  body: string | null;
  published_at: string;
  html_url: string;
  assets: Array<{
    name: string;
    size: number;
    download_count: number;
    browser_download_url: string;
  }>;
}

export interface AppItem {
  id: number;
  full_name: string;
  name: string;
  description: string | null;
  owner: string;
  repo: string;
  avatar_url: string;
  stars: number;
  forks: number;
  language: string | null;
  topics: string[];
  platforms: string[];
  latest_version: string | null;
  latest_release_date: string | null;
  html_url: string;
  updated_at: string;
}

export interface DownloadRecord {
  id: string;
  app_id: number;
  app_name: string;
  owner: string;
  repo: string;
  avatar_url: string;
  version: string;
  download_time: string;
  file_size: number;
  html_url: string;
}

export interface FavoriteItem {
  id: string;
  app_id: number;
  app_name: string;
  owner: string;
  repo: string;
  avatar_url: string;
  description: string | null;
  stars: number;
  language: string | null;
  platforms: string[];
  tags: string[];
  group_name: string;
  added_at: string;
}

export interface SearchHistoryItem {
  id: string;
  keyword: string;
  searched_at: string;
}

export type PlatformType = 'Android' | 'iOS' | 'macOS' | 'Windows' | 'Linux';
export type SortType = 'stars' | 'updated' | 'downloads';
export type CategoryType = '全部' | '开发工具' | '效率工具' | '媒体' | '游戏' | '安全' | '社交' | '系统工具';

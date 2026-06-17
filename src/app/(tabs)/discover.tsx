import React, { useCallback, useRef, useState } from 'react';
import { View, Text, Pressable, FlatList, ActivityIndicator, ScrollView } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/client/supabase';
import { clearAllCache } from '@/lib/cache';
import type { AppItem } from '@/types';
import AppCard from '@/components/openappstore/AppCard';
import SkeletonCard from '@/components/openappstore/SkeletonCard';

const PLATFORMS = [
  { key: '全平台', icon: 'grid-outline',        color: '#1677FF' },
  { key: 'Android', icon: 'logo-android',       color: '#3DDC84' },
  { key: 'iOS',     icon: 'logo-apple',          color: '#555' },
  { key: 'Windows', icon: 'logo-windows',        color: '#0078D7' },
  { key: 'macOS',   icon: 'logo-apple',          color: '#999' },
  { key: 'Linux',   icon: 'terminal-outline',    color: '#E5A00D' },
] as const;

const CATEGORIES = [
  { key: '全部',     topic: '' },
  { key: '开发工具', topic: 'developer-tools' },
  { key: '效率工具', topic: 'productivity' },
  { key: '媒体',     topic: 'media' },
  { key: '游戏',     topic: 'game' },
  { key: '安全',     topic: 'security' },
  { key: '社交',     topic: 'social' },
  { key: '系统工具', topic: 'utility' },
];

const SORT_OPTIONS: { key: string; label: string; icon: string }[] = [
  { key: 'stars',   label: 'Stars',   icon: 'star' },
  { key: 'updated', label: '最新更新', icon: 'time-outline' },
  { key: 'forks',   label: 'Forks',   icon: 'git-branch-outline' },
];

/** 从 app_catalog 行映射到 AppItem */
function rowToAppItem(r: any): AppItem {
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
    has_installable_assets: true, // catalog 里只有有安装包的项目
  };
}

/** 直接查 app_catalog 表，绕开 Edge Function，零冷启动 */
async function fetchCatalog(params: {
  platform: string; topic: string; sort: string; page: number; per_page: number;
}): Promise<{ items: AppItem[]; total_count: number }> {
  const { platform, topic, sort, page, per_page } = params;
  const offset = (page - 1) * per_page;

  const sortMap: Record<string, { col: string; asc: boolean }> = {
    stars:     { col: 'stars',           asc: false },
    updated:   { col: 'updated_at',      asc: false },
    forks:     { col: 'forks',           asc: false },
    downloads: { col: 'total_downloads', asc: false },
  };
  const { col, asc } = sortMap[sort] ?? sortMap.stars;

  let query = supabase
    .from('app_catalog')
    .select('*', { count: 'exact' })
    .eq('archived', false)
    .not('latest_version', 'is', null); // 只返回有安装包（有 release）的项目

  if (platform && platform !== '全平台') {
    query = query.contains('platforms', [platform]);
  }
  if (topic) {
    query = query.contains('topics', [topic]);
  }

  query = query.order(col, { ascending: asc }).range(offset, offset + per_page - 1);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message || '加载失败');
  return { items: (data || []).map(rowToAppItem), total_count: count || 0 };
}

export default function DiscoverTab() {
  const [apps, setApps] = useState<AppItem[]>([]);
  const [loading, setLoading] = useState(true);  // 初始为 true，避免首帧闪现"暂无数据"
  const [refreshing, setRefreshing] = useState(false);
  const [platform, setPlatform] = useState<string>('全平台');
  const [category, setCategory] = useState<string>('全部');
  const [sort, setSort] = useState<string>('stars');
  const [hasMore, setHasMore] = useState(false); // 初始 false，首次加载成功后才置 true
  const [error, setError] = useState<string>('');
  const loadingRef = useRef(false);
  const pageRef = useRef(1);          // 用 ref 追踪页码，避免 stale closure
  const hasFetchedRef = useRef(false); // 首次请求发出后才允许 onEndReached 分页

  const loadData = useCallback(async (
    pageNum = 1, isRefresh = false,
    p = platform, cat = category, s = sort,
  ) => {
    if (loadingRef.current && !isRefresh) return;
    loadingRef.current = true;
    hasFetchedRef.current = true;
    setError('');
    try {
      if (isRefresh) setRefreshing(true);
      else if (pageNum === 1) setLoading(true);
      const topic = CATEGORIES.find((c) => c.key === cat)?.topic ?? '';
      const { items } = await fetchCatalog({ platform: p, topic, sort: s, page: pageNum, per_page: 20 });
      if (pageNum === 1) setApps(items);
      else setApps((prev) => [...prev, ...items]);
      pageRef.current = pageNum;
      setHasMore(items.length >= 20);
    } catch (e: any) {
      console.warn('[Discover] Load failed:', e);
      setError(e?.message || '加载失败，请检查网络后重试');
    } finally {
      setLoading(false);
      setRefreshing(false);
      loadingRef.current = false;
    }
  }, [platform, category, sort]);

  const handleClearCacheAndReload = async () => {
    await clearAllCache();
    hasFetchedRef.current = false;
    pageRef.current = 1;
    setApps([]);
    setHasMore(false);
    loadData(1, false);
  };

  // 只在首次进入页面时加载，不依赖 apps.length
  // 依赖 apps.length 会导致：enrichAppsInBackground 过滤后 apps 变空 → 再次触发 → 无限循环
  useFocusEffect(useCallback(() => {
    if (!hasFetchedRef.current) loadData(1, false);
  }, [loadData]));

  const reset = (p: string, cat: string, s: string) => {
    setPlatform(p); setCategory(cat); setSort(s);
    pageRef.current = 1;
    setApps([]);
    setHasMore(false);
    loadData(1, false, p, cat, s);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F6F8' }} edges={['top']}>
      <FlatList
        data={apps}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <AppCard app={item} />}
        onRefresh={() => { pageRef.current = 1; loadData(1, true); }}
        refreshing={refreshing}
        onEndReached={() => {
          // hasFetchedRef 守卫：避免初始空列表立即触发、抢在 page1 前加载 page2
          if (hasFetchedRef.current && !loadingRef.current && hasMore) {
            const n = pageRef.current + 1;
            loadData(n);
          }
        }}
        onEndReachedThreshold={0.5}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListHeaderComponent={
          <View>
            <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 }}>
              <Text style={{ fontSize: 22, fontWeight: '700', color: '#1A1A1A' }}>发现</Text>
            </View>

            {/* 平台筛选 */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 6, gap: 8 }}>
              {PLATFORMS.map((p) => {
                const active = platform === p.key;
                return (
                  <Pressable key={p.key} onPress={() => reset(p.key, category, sort)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 5,
                      paddingHorizontal: 13, paddingVertical: 7, borderRadius: 20,
                      borderWidth: 1.5, borderColor: active ? '#1677FF' : '#E0E0E0',
                      backgroundColor: active ? '#EBF3FF' : '#fff' }}>
                    <Ionicons name={p.icon as any} size={14} color={active ? '#1677FF' : p.color} />
                    <Text style={{ fontSize: 13, fontWeight: '500', color: active ? '#1677FF' : '#333' }}>{p.key}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* 分类筛选 */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 6, gap: 8 }}>
              {CATEGORIES.map((c) => {
                const active = category === c.key;
                return (
                  <Pressable key={c.key} onPress={() => reset(platform, c.key, sort)}
                    style={{ paddingHorizontal: 13, paddingVertical: 6, borderRadius: 16,
                      backgroundColor: active ? '#1677FF' : '#F0F0F0' }}>
                    <Text style={{ fontSize: 13, fontWeight: active ? '600' : '400',
                      color: active ? '#fff' : '#555' }}>{c.key}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* 排序选项 */}
            <View style={{ flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 10, gap: 8 }}>
              {SORT_OPTIONS.map((s) => {
                const active = sort === s.key;
                return (
                  <Pressable key={s.key} onPress={() => reset(platform, category, s.key)}
                    style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12,
                      borderWidth: 1, borderColor: active ? '#1677FF' : '#E0E0E0',
                      backgroundColor: active ? '#EBF3FF' : '#fff',
                      flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name={s.icon as any} size={13} color={active ? '#1677FF' : '#777'} />
                    <Text style={{ fontSize: 12, color: active ? '#1677FF' : '#777',
                      fontWeight: active ? '600' : '400' }}>{s.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        }
        ListEmptyComponent={
          (loading || !hasFetchedRef.current)
            ? <View style={{ padding: 16 }}>{[1,2,3,4].map((i) => <SkeletonCard key={i} />)}</View>
            : <View style={{ alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 }}>
                <View style={{
                  width: 80, height: 80, borderRadius: 80,
                  backgroundColor: error ? '#FFF2F0' : '#F5F5F5',
                  alignItems: 'center', justifyContent: 'center', marginBottom: 16,
                }}>
                  <Ionicons name={error ? 'alert-circle-outline' : 'compass-outline'} size={40} color={error ? '#FF4D4F' : '#CCC'} />
                </View>
                {error ? (
                  <>
                    <Text style={{ color: '#FF4D4F', fontSize: 14, textAlign: 'center', marginBottom: 12 }}>{error}</Text>
                    <Pressable
                      onPress={handleClearCacheAndReload}
                      style={{ paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#1677FF', borderRadius: 20 }}
                    >
                      <Text style={{ color: '#fff', fontWeight: '600' }}>清除缓存并重试</Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <Text style={{ color: '#AAA', fontSize: 15, textAlign: 'center' }}>暂无数据</Text>
                    <Text style={{ color: '#CCC', fontSize: 13, textAlign: 'center', marginTop: 4 }}>下拉刷新或切换筛选条件</Text>
                    <Pressable
                      onPress={handleClearCacheAndReload}
                      style={{ marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#F5F5F5', borderRadius: 20 }}
                    >
                      <Text style={{ color: '#666', fontSize: 13 }}>清除缓存重试</Text>
                    </Pressable>
                  </>
                )}
              </View>
        }
        ListFooterComponent={
          !loading || apps.length === 0 ? null
            : <View style={{ paddingVertical: 16 }}><ActivityIndicator color="#1677FF" /></View>
        }
      />
    </SafeAreaView>
  );
}

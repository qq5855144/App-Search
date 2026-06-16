import React, { useCallback, useRef, useState } from 'react';
import { View, Text, Pressable, FlatList, ActivityIndicator, ScrollView } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { searchRepos, enrichAppsInBackground } from '@/lib/github';
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
  { key: '全部',     term: 'topic:android-app OR topic:ios-app OR topic:electron' },
  { key: '开发工具', term: 'topic:cli OR topic:terminal OR topic:developer-tools' },
  { key: '效率工具', term: 'topic:productivity OR topic:todo' },
  { key: '媒体',     term: 'topic:music-player OR topic:video-player OR topic:media' },
  { key: '游戏',     term: 'topic:game' },
  { key: '安全',     term: 'topic:security OR topic:password-manager' },
  { key: '社交',     term: 'topic:social OR topic:chat OR topic:messaging' },
  { key: '系统工具', term: 'topic:system OR topic:utility' },
];

const SORT_OPTIONS: { key: string; label: string; icon: string }[] = [
  { key: 'stars',   label: 'Stars',   icon: 'star' },
  { key: 'updated', label: '最新更新', icon: 'time-outline' },
  { key: 'forks',   label: 'Forks',   icon: 'git-branch-outline' },
];

function buildQuery(platform: string, category: string): string {
  const cat = CATEGORIES.find((c) => c.key === category)?.term ?? 'topic:android-app OR topic:ios-app';
  const base = `${cat} stars:>100 archived:false`;
  if (platform === '全平台') return base;
  // 平台过滤用 topic: 格式，GitHub 搜索命中率高
  const platformMap: Record<string, string> = {
    'Android': 'topic:android',
    'iOS':     'topic:ios',
    'Windows': 'topic:windows',
    'macOS':   'topic:macos',
    'Linux':   'topic:linux',
  };
  const platformTerm = platformMap[platform] ?? platform.toLowerCase();
  return `${platformTerm} ${base}`;
}

export default function DiscoverTab() {
  const [apps, setApps] = useState<AppItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [platform, setPlatform] = useState<string>('全平台');
  const [category, setCategory] = useState<string>('全部');
  const [sort, setSort] = useState<string>('stars');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const loadingRef = useRef(false);

  const loadData = useCallback(async (
    pageNum = 1, isRefresh = false,
    p = platform, cat = category, s = sort,
  ) => {
    if (loadingRef.current && !isRefresh) return;
    loadingRef.current = true;
    try {
      if (isRefresh) setRefreshing(true);
      else if (pageNum === 1) setLoading(true);
      const q = buildQuery(p, cat);
      // 首屏直接展示搜索结果，不阻塞等待安装包校验
      const { items } = await searchRepos(q, { page: pageNum, per_page: 20, sort: s });
      if (pageNum === 1) setApps(items);
      else setApps((prev) => [...prev, ...items]);
      setHasMore(items.length >= 20);
      // 后台静默补充版本/下载量信息
      enrichAppsInBackground(items, (enriched) => {
        if (pageNum === 1) setApps(enriched);
        else setApps((prev) => [...prev.slice(0, prev.length - items.length), ...enriched]);
      });
    } catch { /* ignore */ } finally {
      setLoading(false);
      setRefreshing(false);
      loadingRef.current = false;
    }
  }, [platform, category, sort]);

  useFocusEffect(useCallback(() => {
    if (apps.length === 0) loadData(1, false);
  }, [apps.length, loadData]));

  const reset = (p: string, cat: string, s: string) => {
    setPlatform(p); setCategory(cat); setSort(s);
    setPage(1); setApps([]);
    loadData(1, false, p, cat, s);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F6F8' }} edges={['top']}>
      <FlatList
        data={apps}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <AppCard app={item} />}
        onRefresh={() => { setPage(1); loadData(1, true); }}
        refreshing={refreshing}
        onEndReached={() => {
          if (!loadingRef.current && hasMore) { const n = page + 1; setPage(n); loadData(n); }
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
          loading
            ? <View>{[1,2,3,4].map((i) => <SkeletonCard key={i} />)}</View>
            : <View style={{ alignItems: 'center', paddingTop: 60 }}>
                <Ionicons name="compass-outline" size={48} color="#CCC" />
                <Text style={{ color: '#AAA', marginTop: 8 }}>暂无数据</Text>
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

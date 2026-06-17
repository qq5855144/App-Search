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

export default function DiscoverTab() {
  const [apps, setApps] = useState<AppItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [platform, setPlatform] = useState<string>('全平台');
  const [category, setCategory] = useState<string>('全部');
  const [sort, setSort] = useState<string>('stars');
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string>('');
  const loadingRef = useRef(false);
  const pageRef = useRef(1);
  const hasFetchedRef = useRef(false);

  const loadData = useCallback(async (
    pageNum = 1, isRefresh = false,
    p = platform, cat = category, s = sort,
  ) => {
    if (loadingRef.current && !isRefresh) return;
    loadingRef.current = true;
    hasFetchedRef.current = true;
    setError('');
    if (isRefresh) setRefreshing(true);
    else if (pageNum === 1) setLoading(true);
    else setLoadingMore(true);

    try {
      const topic = CATEGORIES.find((c) => c.key === cat)?.topic ?? '';
      const { data, error: fnErr } = await supabase.functions.invoke('search-catalog', {
        body: { platform: p !== '全平台' ? p : undefined, topic: topic || undefined, sort: s, page: pageNum, per_page: 20 },
      });
      if (fnErr) {
        const msg = await fnErr?.context?.text?.().catch(() => '');
        throw new Error(msg || fnErr.message || '加载失败');
      }
      const items: AppItem[] = Array.isArray(data?.data) ? data.data : [];
      if (pageNum === 1) setApps(items);
      else setApps((prev) => [...prev, ...items]);
      pageRef.current = pageNum;
      setHasMore(items.length === 20);
    } catch (e: any) {
      setError(e?.message || '加载失败，请检查网络后重试');
    } finally {
      setLoading(false);
      setLoadingMore(false);
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
          loadingMore
            ? <View style={{ paddingVertical: 16 }}><ActivityIndicator color="#1677FF" /></View>
            : hasMore
              ? <View style={{ paddingVertical: 12, alignItems: 'center' }}><Text style={{ color: '#CCC', fontSize: 12 }}>上滑加载更多</Text></View>
              : apps.length > 0
                ? <View style={{ paddingVertical: 16, alignItems: 'center' }}><Text style={{ color: '#CCC', fontSize: 12 }}>— 已显示全部 —</Text></View>
                : null
        }
      />
    </SafeAreaView>
  );
}

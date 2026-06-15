import React, { useCallback, useRef, useState } from 'react';
import { View, Text, Pressable, FlatList, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { searchRepos } from '@/lib/github';
import type { AppItem } from '@/types';
import AppCard from '@/components/openappstore/AppCard';
import SkeletonCard from '@/components/openappstore/SkeletonCard';

const CATEGORIES = [
  { key: 'latest',  label: '最新',    icon: 'flash-outline',          q: 'mobile app stars:>500' },
  { key: 'rank',    label: '排行',    icon: 'trophy-outline',         q: 'mobile app stars:>5000' },
  { key: 'android', label: 'Android', icon: 'logo-android',           q: 'android app stars:>1000' },
  { key: 'ios',     label: 'iOS',     icon: 'logo-apple',             q: 'ios app stars:>500' },
  { key: 'windows', label: 'Windows', icon: 'logo-windows',           q: 'windows app stars:>500' },
  { key: 'dev',     label: '开发',    icon: 'hammer-outline',         q: 'developer tools stars:>1000' },
  { key: 'media',   label: '媒体',    icon: 'musical-notes-outline',  q: 'media player stars:>500' },
  { key: 'game',    label: '游戏',    icon: 'game-controller-outline', q: 'game stars:>500' },
] as const;

export default function HomeTab() {
  const router = useRouter();
  const [apps, setApps] = useState<AppItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [activeCategory, setActiveCategory] = useState('latest');
  const loadingRef = useRef(false);

  const loadData = useCallback(async (pageNum = 1, isRefresh = false, catKey = activeCategory) => {
    if (loadingRef.current && !isRefresh) return;
    loadingRef.current = true;
    try {
      setError('');
      if (isRefresh) setRefreshing(true);
      else if (pageNum === 1) setLoading(true);
      const cat = CATEGORIES.find((c) => c.key === catKey) || CATEGORIES[0];
      const { items } = await searchRepos(cat.q, { page: pageNum, per_page: 20, sort: 'stars' });
      if (pageNum === 1) setApps(items);
      else setApps((prev) => [...prev, ...items]);
      setHasMore(items.length >= 20);
    } catch (e: any) {
      setError(e?.message || '加载失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
      loadingRef.current = false;
    }
  }, [activeCategory]);

  useFocusEffect(useCallback(() => {
    if (apps.length === 0) loadData(1, false);
  }, [apps.length, loadData]));

  const onCategoryPress = (key: string) => {
    setActiveCategory(key);
    setPage(1);
    setApps([]);
    loadData(1, false, key);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F6F8' }} edges={['top']}>
      <FlatList
        data={apps}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <AppCard app={item} />}
        onRefresh={() => { setPage(1); loadData(1, true); }}
        refreshing={refreshing}
        onEndReached={() => { if (!loadingRef.current && hasMore) { const n = page + 1; setPage(n); loadData(n); } }}
        onEndReachedThreshold={0.5}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListHeaderComponent={
          <View>
            {/* 顶部搜索栏 */}
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8 }}>
              <Pressable
                onPress={() => router.push('/(tabs)/search' as any)}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 24, paddingHorizontal: 14, paddingVertical: 10, gap: 6 }}
              >
                <Ionicons name="search-outline" size={16} color="#AAA" />
                <Text style={{ color: '#AAA', fontSize: 14 }}>搜索开源应用…</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push('/(tabs)/profile' as any)}
                style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#EBF3FF', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#1677FF' }}
              >
                <Ionicons name="logo-github" size={20} color="#1677FF" />
              </Pressable>
            </View>
            {/* 分类 2×4 grid */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8, paddingBottom: 8 }}>
              {CATEGORIES.map((cat) => (
                <Pressable key={cat.key} onPress={() => onCategoryPress(cat.key)}
                  style={{ width: '25%', alignItems: 'center', paddingVertical: 8, gap: 4 }}>
                  <View style={{
                    width: 50, height: 50, borderRadius: 14, backgroundColor: '#fff',
                    alignItems: 'center', justifyContent: 'center',
                    borderWidth: activeCategory === cat.key ? 2 : 0,
                    borderColor: '#1677FF',
                  }}>
                    <Ionicons name={cat.icon as any} size={22} color={activeCategory === cat.key ? '#1677FF' : '#555'} />
                  </View>
                  <Text style={{ fontSize: 11, color: activeCategory === cat.key ? '#1677FF' : '#666' }}>{cat.label}</Text>
                </Pressable>
              ))}
            </View>
            <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#1A1A1A' }}>全部应用</Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          loading
            ? <View>{[1,2,3,4,5].map((i) => <SkeletonCard key={i} />)}</View>
            : error
              ? (
                <View style={{ alignItems: 'center', paddingTop: 40 }}>
                  <Text style={{ color: '#f00', marginBottom: 12 }}>{error}</Text>
                  <Pressable onPress={() => loadData(1)} style={{ backgroundColor: '#1677FF', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 }}>
                    <Text style={{ color: '#fff' }}>重试</Text>
                  </Pressable>
                </View>
              )
              : <View style={{ alignItems: 'center', paddingTop: 60 }}><Text style={{ color: '#AAA' }}>暂无数据</Text></View>
        }
        ListFooterComponent={
          !loading || apps.length === 0 ? null
            : <View style={{ paddingVertical: 16 }}><ActivityIndicator color="#1677FF" /></View>
        }
      />
    </SafeAreaView>
  );
}

// 分类配置：图标名、背景色、标签颜色
const CATEGORIES = [
  { key: 'latest',   label: '最新',   icon: 'flash',         bg: '#FFF3E0', color: '#FF8C00' },
  { key: 'rank',     label: '排行',   icon: 'trophy',        bg: '#E3F2FD', color: '#1677FF' },
  { key: 'Android',  label: 'Android',icon: 'logo-android',  bg: '#E8F5E9', color: '#3DDC84' },
  { key: 'iOS',      label: 'iOS',    icon: 'logo-apple',    bg: '#F3F3F3', color: '#1A1A1A' },
  { key: 'Windows',  label: 'Windows',icon: 'logo-windows',  bg: '#E3F2FD', color: '#0078D7' },
  { key: 'dev',      label: '开发',   icon: 'hammer',        bg: '#EDE7F6', color: '#7B2FBE' },
  { key: 'media',    label: '媒体',   icon: 'musical-notes', bg: '#FCE4EC', color: '#E91E8C' },
  { key: 'game',     label: '游戏',   icon: 'game-controller',bg: '#FFF3E0', color: '#FF6B35' },
] as const;

// 每次加载都用真实 query
function buildQuery(key: string): string {
  const map: Record<string, string> = {
    latest:  'mobile app stars:>500',
    rank:    'mobile app stars:>5000',
    Android: 'android app stars:>1000',
    iOS:     'ios app stars:>500',
    Windows: 'windows app stars:>500',
    dev:     'developer tools stars:>1000',
    media:   'media player stars:>500',
    game:    'game stars:>500',
  };
  return map[key] || 'mobile app stars:>500';
}

export default function HomeTab() {
  const router = useRouter();
  const [apps, setApps] = useState<AppItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [activeCategory, setActiveCategory] = useState('latest');
  const flatListRef = useRef<FlatList>(null);
  // BUG 4 修复：用 ref 防止 onEndReached 竞态条件
  // loading state 的更新是异步的，两次快速触发间 loading 仍为 false，导致重复加载
  const loadingRef = useRef(false);

  const loadData = useCallback(async (pageNum = 1, isRefresh = false, catKey = activeCategory) => {
    if (loadingRef.current && !isRefresh) return;
    loadingRef.current = true;
    try {
      setError('');
      if (isRefresh) setRefreshing(true);
      else if (pageNum === 1) setLoading(true);

      const query = buildQuery(catKey);
      const { items } = await searchRepos(query, { page: pageNum, per_page: 30, sort: 'stars' });

      if (pageNum === 1) setApps(items);
      else setApps((prev) => [...prev, ...items]);
      setHasMore(items.length >= 30);
    } catch (e: any) {
      setError(e.message || '数据加载失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
      loadingRef.current = false;
    }
  }, [activeCategory]);

  useFocusEffect(
    useCallback(() => {
      if (apps.length === 0) loadData(1, false);
    }, [apps.length, loadData])
  );

  const onCategoryPress = (key: string) => {
    setActiveCategory(key);
    setPage(1);
    setApps([]);
    loadData(1, false, key);
  };

  const onRefresh = () => { setPage(1); loadData(1, true); };
  const onEndReached = () => {
    if (!loadingRef.current && hasMore) {
      const next = page + 1;
      setPage(next);
      loadData(next, false);
    }
  };

  const renderHeader = () => (
    <View>
      {/* 搜索栏 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16, gap: 10 }}>
        {/* 搜索框 */}
        <Pressable
          onPress={() => router.push('/(tabs)/search?focus=1' as any)}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#FFFFFF',
            paddingHorizontal: 16,
            paddingVertical: 11,
            borderRadius: 40,
            boxShadow: [{ offsetX: 0, offsetY: 1, blurRadius: 4, color: 'rgba(0,0,0,0.06)' }],
            gap: 6,
          }}
        >
          <Ionicons name="search-outline" size={16} color="#AAAAAA" />
          <Text style={{ color: '#AAAAAA', fontSize: 14 }}>搜索应用、开发工具…</Text>
        </Pressable>
        {/* 铃铛 */}
        <Pressable
          onPress={() => {}}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: '#FFFFFF',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: [{ offsetX: 0, offsetY: 1, blurRadius: 4, color: 'rgba(0,0,0,0.06)' }],
          }}
        >
          <Ionicons name="notifications-outline" size={20} color="#555555" />
        </Pressable>
        {/* GitHub 圆圈图标（替代破损头像图片） */}
        <Pressable
          onPress={() => router.push('/(tabs)/profile' as any)}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            borderWidth: 2,
            borderColor: '#1677FF',
            backgroundColor: '#EBF3FF',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="logo-github" size={22} color="#1677FF" />
        </Pressable>
      </View>

      {/* 分类图标网格 —— 2 行 × 4 列，无需横滑 */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, paddingBottom: 12 }}>
        {CATEGORIES.map((cat) => (
          <Pressable
            key={cat.key}
            onPress={() => onCategoryPress(cat.key)}
            style={{ width: '25%', alignItems: 'center', gap: 6, paddingVertical: 8, outlineWidth: 0, outlineStyle: 'none' } as any}
          >
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 14,
                backgroundColor: cat.bg,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: activeCategory === cat.key ? 2 : 0,
                borderColor: cat.color,
              }}
            >
              <Ionicons name={cat.icon as any} size={24} color={cat.color} />
            </View>
            <Text style={{ fontSize: 11, color: activeCategory === cat.key ? '#1677FF' : '#666666', textAlign: 'center' }}>
              {cat.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* 全部应用标题 */}
      <View className="px-4 pb-2">
        <Text className="text-base font-bold text-foreground">全部应用</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F6F8' }} edges={['top']}>
      <FlatList
        ref={flatListRef}
        data={apps}
        renderItem={({ item }) => <AppCard app={item} />}
        keyExtractor={(item) => item.id.toString()}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          loading ? (
            <View className="px-0 pt-2">
              {[1, 2, 3, 4, 5].map((i) => <SkeletonCard key={i} />)}
            </View>
          ) : (
            <EmptyState title="暂无应用数据" />
          )
        }
        ListFooterComponent={
          !loading || refreshing ? null : (
            <View className="py-4">
              <ActivityIndicator color="#1677FF" />
            </View>
          )
        }
        onRefresh={onRefresh}
        refreshing={refreshing}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        contentContainerStyle={{ paddingBottom: 24 }}
      />
      {error ? (
        <View className="absolute inset-0 items-center justify-center bg-background/80">
          <Text className="text-destructive mb-3 text-sm">{error}</Text>
          <Pressable
            onPress={() => loadData(1, false)}
            style={{
              backgroundColor: '#1677FF',
              paddingHorizontal: 24,
              paddingVertical: 8,
              borderRadius: 24,
            }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>重试</Text>
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

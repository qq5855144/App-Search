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
  { key: 'latest',  label: '最新',    icon: 'flash',            color: '#FF6B35', bg: '#FFF3E0', q: 'mobile app stars:>500' },
  { key: 'rank',    label: '排行',    icon: 'trophy',           color: '#1677FF', bg: '#EBF3FF', q: 'mobile app stars:>5000' },
  { key: 'android', label: 'Android', icon: 'logo-android',    color: '#3DDC84', bg: '#E8F5E9', q: 'android app stars:>1000' },
  { key: 'ios',     label: 'iOS',     icon: 'logo-apple',      color: '#1A1A1A', bg: '#F5F5F7', q: 'ios app stars:>500' },
  { key: 'windows', label: 'Windows', icon: 'logo-windows',    color: '#00A4EF', bg: '#E3F2FD', q: 'windows app stars:>500' },
  { key: 'dev',     label: '开发',    icon: 'hammer',          color: '#9C27B0', bg: '#F3E5F5', q: 'developer tools stars:>1000' },
  { key: 'media',   label: '媒体',    icon: 'musical-notes',   color: '#E91E63', bg: '#FCE4EC', q: 'media player stars:>500' },
  { key: 'game',    label: '游戏',    icon: 'game-controller',  color: '#FF5722', bg: '#FBE9E7', q: 'game stars:>500' },
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
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4, gap: 8 }}>
              <Pressable
                onPress={() => router.push('/(tabs)/search' as any)}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
                  borderRadius: 24, paddingHorizontal: 14, paddingVertical: 11, gap: 6,
                  boxShadow: [{ offsetX: 0, offsetY: 1, blurRadius: 3, color: 'rgba(0,0,0,0.06)' }] }}
              >
                <Ionicons name="search-outline" size={16} color="#AAAAAA" />
                <Text style={{ color: '#AAAAAA', fontSize: 14 }}>搜索应用、开发工具…</Text>
              </Pressable>
              <Pressable
                onPress={() => {}}
                style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff',
                  alignItems: 'center', justifyContent: 'center',
                  boxShadow: [{ offsetX: 0, offsetY: 1, blurRadius: 3, color: 'rgba(0,0,0,0.06)' }] }}
              >
                <Ionicons name="notifications-outline" size={20} color="#555" />
              </Pressable>
              <Pressable
                onPress={() => router.push('/(tabs)/profile' as any)}
                style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#EBF3FF',
                  alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#1677FF' }}
              >
                <Ionicons name="logo-github" size={20} color="#1677FF" />
              </Pressable>
            </View>
            {/* 分类 2×4 grid */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 4, paddingVertical: 8 }}>
              {CATEGORIES.map((cat) => {
                const isActive = activeCategory === cat.key;
                return (
                  <Pressable key={cat.key} onPress={() => onCategoryPress(cat.key)}
                    style={{ width: '25%', alignItems: 'center', paddingVertical: 8, gap: 6 }}>
                    <View style={{
                      width: 54, height: 54, borderRadius: 16, backgroundColor: cat.bg,
                      alignItems: 'center', justifyContent: 'center',
                      borderWidth: isActive ? 2.5 : 0,
                      borderColor: cat.color,
                    }}>
                      <Ionicons name={cat.icon as any} size={24} color={cat.color} />
                    </View>
                    <Text style={{ fontSize: 12, color: isActive ? cat.color : '#555', fontWeight: isActive ? '600' : '400' }}>
                      {cat.label}
                    </Text>
                  </Pressable>
                );
              })}
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

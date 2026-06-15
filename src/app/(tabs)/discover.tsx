import React, { useCallback, useRef, useState } from 'react';
import { View, Text, Pressable, FlatList, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { searchRepos } from '@/lib/github';
import type { AppItem } from '@/types';
import AppCard from '@/components/openappstore/AppCard';
import SkeletonCard from '@/components/openappstore/SkeletonCard';

const PLATFORMS = [
  { key: 'Android', icon: 'logo-android',      color: '#3DDC84' },
  { key: 'iOS',     icon: 'logo-apple',         color: '#555' },
  { key: 'Windows', icon: 'logo-windows',       color: '#0078D7' },
  { key: 'macOS',   icon: 'logo-apple',         color: '#999' },
  { key: 'Linux',   icon: 'terminal-outline',   color: '#E5A00D' },
] as const;

const QUERY: Record<string, string> = {
  Android: 'android app stars:>1000',
  iOS:     'ios app stars:>500',
  Windows: 'windows app stars:>500',
  macOS:   'macos app stars:>500',
  Linux:   'linux app stars:>500',
};

export default function DiscoverTab() {
  const [apps, setApps] = useState<AppItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [platform, setPlatform] = useState<string>('Android');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const loadingRef = useRef(false);

  const loadData = useCallback(async (pageNum = 1, isRefresh = false, p = platform) => {
    if (loadingRef.current && !isRefresh) return;
    loadingRef.current = true;
    try {
      if (isRefresh) setRefreshing(true);
      else if (pageNum === 1) setLoading(true);
      const { items } = await searchRepos(QUERY[p] || QUERY.Android, { page: pageNum, per_page: 20, sort: 'stars' });
      if (pageNum === 1) setApps(items);
      else setApps((prev) => [...prev, ...items]);
      setHasMore(items.length >= 20);
    } catch { /* ignore */ } finally {
      setLoading(false);
      setRefreshing(false);
      loadingRef.current = false;
    }
  }, [platform]);

  useFocusEffect(useCallback(() => {
    if (apps.length === 0) loadData(1, false);
  }, [apps.length, loadData]));

  const onPlatformPress = (p: string) => {
    setPlatform(p);
    setPage(1);
    setApps([]);
    loadData(1, false, p);
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
            <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
              <Text style={{ fontSize: 22, fontWeight: '700', color: '#1A1A1A' }}>发现</Text>
            </View>
            <View style={{ flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 12, gap: 8, flexWrap: 'wrap' }}>
              {PLATFORMS.map((p) => {
                const active = platform === p.key;
                return (
                  <Pressable key={p.key} onPress={() => onPlatformPress(p.key)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 5,
                      paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
                      borderWidth: 1.5, borderColor: active ? '#1677FF' : '#E0E0E0',
                      backgroundColor: active ? '#EBF3FF' : '#fff' }}>
                    <Ionicons name={p.icon as any} size={14} color={active ? '#1677FF' : p.color} />
                    <Text style={{ fontSize: 13, fontWeight: '500', color: active ? '#1677FF' : '#333' }}>{p.key}</Text>
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

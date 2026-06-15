import { View, Text, Pressable, FlatList, ActivityIndicator } from 'react-native';
import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { searchRepos } from '@/lib/github';
import type { AppItem, PlatformType, SortType } from '@/types';
import AppCard from '@/components/openappstore/AppCard';
import EmptyState from '@/components/openappstore/EmptyState';
import SkeletonCard from '@/components/openappstore/SkeletonCard';

// 平台按钮配置（带图标）
const PLATFORMS: { key: PlatformType | '全部'; label: string; icon?: string; color?: string }[] = [
  { key: 'Android', label: 'Android', icon: 'logo-android', color: '#3DDC84' },
  { key: 'iOS',     label: 'iOS',     icon: 'logo-apple',   color: '#1A1A1A' },
  { key: 'macOS',   label: 'macOS',   icon: 'logo-apple',   color: '#666666' },
  { key: 'Windows', label: 'Windows', icon: 'logo-windows', color: '#0078D7' },
  { key: 'Linux',   label: 'Linux',   icon: 'logo-tux',     color: '#E5A00D' },
];

const SORTS: { key: SortType; label: string }[] = [
  { key: 'stars',   label: 'Stars数' },
  { key: 'updated', label: '最新更新' },
];

function buildQuery(platform: PlatformType | '全部'): string {
  const map: Record<string, string> = {
    '全部':    'mobile app stars:>500',
    Android:  'android app stars:>1000',
    iOS:      'ios app stars:>500',
    macOS:    'macos app stars:>500',
    Windows:  'windows app stars:>500',
    Linux:    'linux app stars:>500',
  };
  return map[platform] || 'mobile app stars:>500';
}

export default function DiscoverTab() {
  const [apps, setApps] = useState<AppItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformType | null>(null);
  const [selectedSort, setSelectedSort] = useState<SortType>('stars');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  // BUG 4 修复：用 ref 防竞态——loading state 异步更新，两次快速 onEndReached 都能通过 !loading 检查
  const loadingRef = useRef(false);

  const loadData = useCallback(
    async (pageNum = 1, isRefresh = false, platform = selectedPlatform, sort = selectedSort) => {
      if (loadingRef.current && !isRefresh) return;
      loadingRef.current = true;
      try {
        if (isRefresh) setRefreshing(true);
        else if (pageNum === 1) setLoading(true);

        const query = buildQuery(platform ?? '全部');
        const { items } = await searchRepos(query, {
          page: pageNum,
          per_page: 15,
          sort: sort,
          order: 'desc',
        });

        if (pageNum === 1) setApps(items);
        else setApps((prev) => [...prev, ...items]);
        setHasMore(items.length >= 15);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
        setRefreshing(false);
        loadingRef.current = false;
      }
    },
    [selectedPlatform, selectedSort]
  );

  const handlePlatformPress = (p: PlatformType) => {
    const next = selectedPlatform === p ? null : p;
    setSelectedPlatform(next);
    setPage(1);
    setApps([]);
    loadData(1, false, next, selectedSort);
  };

  const handleSortPress = (s: SortType) => {
    setSelectedSort(s);
    setPage(1);
    setApps([]);
    loadData(1, false, selectedPlatform, s);
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
      {/* 标题 */}
      <View className="px-4 pt-3 pb-3">
        <Text className="text-2xl font-bold text-foreground">发现</Text>
      </View>

      {/* 平台分类卡片 */}
      <View
        className="mx-4 mb-3 p-4 rounded-2xl bg-card"
        style={{ boxShadow: [{ offsetX: 0, offsetY: 1, blurRadius: 4, color: 'rgba(0,0,0,0.07)' }] }}
      >
        <Text className="text-sm font-bold text-foreground mb-3">平台分类</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {PLATFORMS.map((p) => {
            const active = selectedPlatform === p.key;
            return (
              <Pressable
                key={p.key}
                onPress={() => handlePlatformPress(p.key as PlatformType)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 24,
                  borderWidth: 1.5,
                  borderColor: active ? '#1677FF' : '#E0E0E0',
                  backgroundColor: active ? '#EBF3FF' : '#FFFFFF',
                  gap: 6,
                }}
              >
                {p.icon && (
                  <Ionicons
                    name={p.icon as any}
                    size={16}
                    color={active ? '#1677FF' : (p.color || '#666666')}
                  />
                )}
                <Text style={{ fontSize: 13, fontWeight: '500', color: active ? '#1677FF' : '#333333' }}>
                  {p.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* 排序行 */}
      <View className="flex-row items-center px-4 mb-3" style={{ gap: 8 }}>
        <Text className="text-sm text-muted-foreground">排序：</Text>
        {SORTS.map((s) => {
          const active = selectedSort === s.key;
          return (
            <Pressable
              key={s.key}
              onPress={() => handleSortPress(s.key)}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 7,
                borderRadius: 24,
                borderWidth: 1.5,
                borderColor: active ? '#1677FF' : '#E0E0E0',
                backgroundColor: active ? '#FFFFFF' : '#FFFFFF',
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: active ? '600' : '400', color: active ? '#1677FF' : '#666666' }}>
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F6F8' }} edges={['top']}>
      <FlatList
        data={apps}
        renderItem={({ item }) => <AppCard app={item} />}
        keyExtractor={(item) => item.id.toString()}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          loading ? (
            <View className="px-0">
              {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
            </View>
          ) : selectedPlatform ? (
            <EmptyState title="分类加载中…" />
          ) : (
            <View className="flex-1 items-center justify-center py-16">
              <Ionicons name="compass-outline" size={48} color="#CCCCCC" />
              <Text style={{ color: '#AAAAAA', marginTop: 10, fontSize: 14 }}>请选择平台开始浏览</Text>
            </View>
          )
        }
        ListFooterComponent={
          loading && apps.length > 0 ? (
            <View className="py-4"><ActivityIndicator color="#1677FF" /></View>
          ) : null
        }
        onRefresh={onRefresh}
        refreshing={refreshing}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </SafeAreaView>
  );
}

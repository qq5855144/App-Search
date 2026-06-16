import React, { useCallback, useState, useEffect } from 'react';
import { View, Text, Pressable, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { searchRepos } from '@/lib/github';
import type { AppItem } from '@/types';
import { getTopAppsByScore, getPopularKeywords, type TimeRange } from '@/lib/events';
import AppCard from '@/components/openappstore/AppCard';

type RankType = 'hot' | 'download' | 'star' | 'trending';

const RANK_TYPES: { key: RankType; label: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { key: 'hot', label: '热门', icon: 'flame', color: '#FF6B35' },
  { key: 'download', label: '下载', icon: 'download-outline', color: '#1677FF' },
  { key: 'star', label: '收藏', icon: 'star', color: '#FFB300' },
  { key: 'trending', label: '趋势', icon: 'trending-up', color: '#52C41A' },
];

const TIME_RANGES: { key: TimeRange; label: string }[] = [
  { key: 'day', label: '今日' },
  { key: 'week', label: '本周' },
  { key: 'month', label: '本月' },
  { key: 'all', label: '全部' },
];

export default function RankingsScreen() {
  const router = useRouter();
  const [activeRank, setActiveRank] = useState<RankType>('hot');
  const [activeTimeRange, setActiveTimeRange] = useState<TimeRange>('week');
  const [apps, setApps] = useState<AppItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [localRanks, setLocalRanks] = useState<{ app_id: number; score: number; views: number; downloads: number; favorites: number; app_name?: string; owner?: string; repo?: string }[]>([]);
  const [popularKeywords, setPopularKeywords] = useState<{ keyword: string; count: number }[]>([]);
  const [localApps, setLocalApps] = useState<Map<number, { name: string; owner: string; repo: string }>>(new Map());

  const loadLocalRanks = useCallback(async () => {
    try {
      const ranks = await getTopAppsByScore(30, activeTimeRange);
      setLocalRanks(ranks.map((rank) => ({
        app_id: rank.app_id,
        score: rank.score,
        views: rank.views,
        downloads: rank.downloads,
        favorites: rank.favorites,
        app_name: rank.app_name,
      })));
    } catch {
      setLocalRanks([]);
    }
  }, [activeTimeRange]);

  const loadKeywords = useCallback(async () => {
    try {
      const keywords = await getPopularKeywords(8, activeTimeRange);
      setPopularKeywords(keywords);
    } catch {
      setPopularKeywords([]);
    }
  }, [activeTimeRange]);

  const loadApps = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      let query = '';
      let sort = 'stars';

      switch (activeRank) {
        case 'hot':
          query = 'open source app release stars:>500';
          sort = 'stars';
          break;
        case 'download':
          query = 'open source app release downloads stars:>200';
          sort = 'stars';
          break;
        case 'star':
          query = 'open source app release stars:>1000';
          sort = 'stars';
          break;
        case 'trending':
          query = 'open source app release pushed:>2024-06-01 stars:>200';
          sort = 'updated';
          break;
      }

      const { items } = await searchRepos(query, { page: 1, per_page: 20, sort, installableOnly: true });
      setApps(items);
      
      const newLocalApps = new Map(localApps);
      items.forEach((app) => {
        newLocalApps.set(app.id, { name: app.name, owner: app.owner, repo: app.repo });
      });
      setLocalApps(newLocalApps);
    } catch (e) {
      console.warn('榜单加载失败', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeRank, localApps]);

  useEffect(() => {
    loadLocalRanks();
    loadKeywords();
  }, [loadLocalRanks, loadKeywords]);

  useEffect(() => {
    loadApps();
  }, [loadApps]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadApps(true), loadLocalRanks(), loadKeywords()]);
  }, [loadApps, loadLocalRanks, loadKeywords]);

  const handleKeywordPress = (keyword: string) => {
    router.push({ pathname: '/(tabs)/search', params: { q: keyword } } as any);
  };

  const handleAppPress = (app: AppItem) => {
    router.push({ pathname: '/detail/[id]', params: { id: String(app.id), owner: app.owner, repo: app.repo } } as any);
  };

  const renderRankBadge = (index: number) => {
    const colors = ['#FFD700', '#C0C0C0', '#CD7F32'];
    const trophyColors = ['#B8860B', '#808080', '#8B4513'];
    if (index >= 3) return null;
    return (
      <View
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          width: 32,
          height: 32,
          borderRadius: 32,
          backgroundColor: colors[index],
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
          boxShadow: [{ offsetX: 0, offsetY: 2, blurRadius: 4, color: 'rgba(0,0,0,0.2)' }],
        }}
      >
        <Ionicons name="trophy" size={16} color={trophyColors[index]} />
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F6F8' }} edges={['top']}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: '#fff',
          borderBottomWidth: 0.5,
          borderBottomColor: '#E8E8E8',
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={12} style={{ marginRight: 12 }}>
          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
        </Pressable>
        <Text style={{ flex: 1, fontSize: 18, fontWeight: '700' }}>应用榜单</Text>
        <Pressable onPress={handleRefresh} hitSlop={12}>
          <Ionicons name="refresh" size={22} color="#888" />
        </Pressable>
      </View>

      <FlatList
        data={apps}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item, index }) => (
          <Pressable onPress={() => handleAppPress(item)} style={{ position: 'relative' }}>
            {renderRankBadge(index)}
            <AppCard app={item} />
          </Pressable>
        )}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListHeaderComponent={
          <View>
            <View
              style={{
                flexDirection: 'row',
                paddingHorizontal: 16,
                paddingTop: 16,
                gap: 8,
              }}
            >
              {RANK_TYPES.map((rank) => (
                <Pressable
                  key={rank.key}
                  onPress={() => setActiveRank(rank.key)}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    paddingVertical: 11,
                    borderRadius: 14,
                    backgroundColor: activeRank === rank.key ? `${rank.color}1A` : '#fff',
                    borderWidth: 1.5,
                    borderColor: activeRank === rank.key ? rank.color : '#E0E0E0',
                  }}
                >
                  <Ionicons
                    name={rank.icon}
                    size={18}
                    color={activeRank === rank.key ? rank.color : '#888'}
                  />
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: activeRank === rank.key ? '600' : '400',
                      color: activeRank === rank.key ? rank.color : '#555',
                    }}
                  >
                    {rank.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {(localRanks.length > 0 || popularKeywords.length > 0) && (
              <View
                style={{
                  flexDirection: 'row',
                  paddingHorizontal: 16,
                  paddingTop: 12,
                  gap: 8,
                }}
              >
                {TIME_RANGES.map((range) => (
                  <Pressable
                    key={range.key}
                    onPress={() => setActiveTimeRange(range.key)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 6,
                      borderRadius: 20,
                      backgroundColor: activeTimeRange === range.key ? '#1677FF' : '#fff',
                      borderWidth: 1,
                      borderColor: activeTimeRange === range.key ? '#1677FF' : '#E0E0E0',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: activeTimeRange === range.key ? '600' : '400',
                        color: activeTimeRange === range.key ? '#fff' : '#666',
                      }}
                    >
                      {range.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            {localRanks.length > 0 && (
              <View style={{ marginHorizontal: 16, marginTop: 16, backgroundColor: '#fff', borderRadius: 16, padding: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                  <Ionicons name="trending-up" size={18} color="#52C41A" />
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#1A1A1A' }}>我的常用</Text>
                  <Text style={{ fontSize: 12, color: '#999' }}>{localRanks.length}个应用</Text>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {localRanks.slice(0, 6).map((rank) => {
                    const app = apps.find((a) => a.id === rank.app_id);
                    const displayName = app?.name || rank.app_name || '未知应用';
                    return (
                      <Pressable
                        key={rank.app_id}
                        onPress={() => {
                          if (app) {
                            handleAppPress(app);
                          } else if (rank.owner && rank.repo) {
                            router.push({ pathname: '/detail/[id]', params: { id: String(rank.app_id), owner: rank.owner, repo: rank.repo } } as any);
                          }
                        }}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 7,
                          backgroundColor: '#F5F5F5',
                          borderRadius: 20,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <Text style={{ fontSize: 13, color: '#1A1A1A', fontWeight: '500' }}>{displayName}</Text>
                        <View
                          style={{
                            width: 16,
                            height: 16,
                            borderRadius: 16,
                            backgroundColor: '#E8F4FF',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Ionicons name="download-outline" size={10} color="#1677FF" />
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {popularKeywords.length > 0 && (
              <View style={{ marginHorizontal: 16, marginTop: 16, backgroundColor: '#fff', borderRadius: 16, padding: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                  <Ionicons name="search-outline" size={18} color="#1677FF" />
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#1A1A1A' }}>热门搜索</Text>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {popularKeywords.map((item, index) => (
                    <Pressable
                      key={item.keyword}
                      onPress={() => handleKeywordPress(item.keyword)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 7,
                        backgroundColor: '#F5F5F5',
                        borderRadius: 20,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: '700',
                          color: ['#FF6B35', '#1677FF', '#52C41A', '#9C27B0', '#E91E63'][index % 5],
                        }}
                      >
                        {index + 1}
                      </Text>
                      <Text style={{ fontSize: 13, color: '#1A1A1A', fontWeight: '500' }}>{item.keyword}</Text>
                      <Text style={{ fontSize: 11, color: '#999' }}>{item.count}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            <View style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons
                  name={RANK_TYPES.find((r) => r.key === activeRank)?.icon || 'trophy'}
                  size={22}
                  color={RANK_TYPES.find((r) => r.key === activeRank)?.color || '#1677FF'}
                />
                <Text style={{ fontSize: 17, fontWeight: '700', color: '#1A1A1A' }}>
                  {RANK_TYPES.find((r) => r.key === activeRank)?.label}榜单
                </Text>
                <Text style={{ fontSize: 12, color: '#999' }}>TOP {apps.length}</Text>
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={{ padding: 16 }}>{[1, 2, 3, 4, 5].map((i) => <SkeletonCard key={i} />)}</View>
          ) : (
            <View style={{ alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 }}>
              <View
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 80,
                  backgroundColor: '#F0F0F0',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                }}
              >
                <Ionicons name="trophy-outline" size={40} color="#CCC" />
              </View>
              <Text style={{ color: '#AAA', fontSize: 15, textAlign: 'center' }}>暂无数据</Text>
              <Text style={{ color: '#DDD', fontSize: 13, textAlign: 'center', marginTop: 4 }}>
                快来探索优质开源应用吧
              </Text>
            </View>
          )
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#1677FF" />
        }
      />
    </SafeAreaView>
  );
}

function SkeletonCard() {
  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 8 }}>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: '#F0F0F0' }} />
        <View style={{ flex: 1, gap: 6 }}>
          <View style={{ height: 18, backgroundColor: '#F0F0F0', borderRadius: 4 }} />
          <View style={{ height: 14, backgroundColor: '#F0F0F0', borderRadius: 4, width: '70%' }} />
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
            <View style={{ height: 14, backgroundColor: '#F0F0F0', borderRadius: 4, width: 40 }} />
            <View style={{ height: 14, backgroundColor: '#F0F0F0', borderRadius: 4, width: 60 }} />
          </View>
        </View>
      </View>
    </View>
  );
}

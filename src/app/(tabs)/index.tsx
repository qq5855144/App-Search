import React, { useCallback, useRef, useState } from 'react';
import { View, Text, Pressable, FlatList, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/client/supabase';
import type { AppItem } from '@/types';
import AppCard from '@/components/openappstore/AppCard';
import SkeletonCard from '@/components/openappstore/SkeletonCard';

const PAGE_SIZE = 20;

// 分类配置：platform/topic 基于 app_catalog 实际数据分布
// platform=null 表示不限平台；topic=null 表示不限 topic
const CATEGORIES: {
  key: string; label: string; icon: string; color: string; bg: string;
  platform: string | null; topic: string | null; orderBy: string;
}[] = [
  { key: 'latest',  label: '最新',    icon: 'flash',           color: '#FF6B35', bg: '#FFF3E0', platform: null,      topic: null,           orderBy: 'updated_at' },
  { key: 'rank',    label: '排行',    icon: 'trophy',          color: '#1677FF', bg: '#EBF3FF', platform: null,      topic: null,           orderBy: 'stars'      },
  { key: 'android', label: 'Android', icon: 'logo-android',   color: '#3DDC84', bg: '#E8F5E9', platform: 'Android', topic: null,           orderBy: 'stars'      },
  { key: 'ios',     label: 'iOS',     icon: 'logo-apple',     color: '#1A1A1A', bg: '#F5F5F7', platform: 'iOS',     topic: null,           orderBy: 'stars'      },
  { key: 'windows', label: 'Windows', icon: 'logo-windows',   color: '#00A4EF', bg: '#E3F2FD', platform: 'Windows', topic: null,           orderBy: 'stars'      },
  { key: 'dev',     label: '开发',    icon: 'hammer',         color: '#9C27B0', bg: '#F3E5F5', platform: null,      topic: 'terminal',     orderBy: 'stars'      },
  { key: 'media',   label: '媒体',    icon: 'musical-notes',  color: '#E91E63', bg: '#FCE4EC', platform: null,      topic: 'music',        orderBy: 'stars'      },
  { key: 'game',    label: '游戏',    icon: 'game-controller', color: '#FF5722', bg: '#FBE9E7', platform: null,      topic: 'game',         orderBy: 'stars'      },
];

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
      const from = (pageNum - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      // 直接查 app_catalog，零冷启动，不依赖 GitHub API
      let query = supabase
        .from('app_catalog')
        .select('*')
        .eq('archived', false)
        .not('latest_version', 'is', null) // 只要有安装包的项目
        .order(cat.orderBy, { ascending: false })
        .range(from, to);

      // 平台过滤：platforms 是数组，用 cs（contains）匹配
      if (cat.platform) query = query.contains('platforms', [cat.platform]);
      // topic 过滤：topics 是数组，用 cs 匹配
      if (cat.topic) query = query.contains('topics', [cat.topic]);

      const { data, error: dbError } = await query;
      if (dbError) throw new Error(dbError.message);

      const items: AppItem[] = (data || []).map((r: any): AppItem => ({
        id: r.id, full_name: r.full_name, name: r.name,
        description: r.description, owner: r.owner, repo: r.repo,
        avatar_url: r.avatar_url || '', stars: r.stars || 0,
        forks: r.forks || 0, language: r.language, topics: r.topics || [],
        platforms: r.platforms || [], latest_version: r.latest_version,
        latest_release_date: r.latest_release_date,
        html_url: r.html_url || `https://github.com/${r.owner}/${r.repo}`,
        updated_at: r.updated_at || '', license: r.license,
        archived: r.archived || false, open_issues_count: r.open_issues_count || 0,
        total_downloads: r.total_downloads || 0, has_installable_assets: true,
      }));

      if (pageNum === 1) setApps(items);
      else setApps((prev) => [...prev, ...items]);
      setHasMore(items.length >= PAGE_SIZE);
    } catch (e: any) {
      setError(e?.message || '加载失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
      loadingRef.current = false;
    }
  }, [activeCategory]);

  // 仅在「从未成功加载过且没有错误」时才自动触发，避免报错后反复闪烁重试
  useFocusEffect(useCallback(() => {
    if (apps.length === 0 && !error) loadData(1, false);
  }, [apps.length, error, loadData]));

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

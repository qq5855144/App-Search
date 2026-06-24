import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, Pressable, FlatList, ScrollView, ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAndroidExitBack } from '@/hooks/useAndroidExitBack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/client/supabase';
import type { AppItem } from '@/types';
import AppCard from '@/components/openappstore/AppCard';
import AppIcon from '@/components/openappstore/AppIcon';
import TranslatedText from '@/components/openappstore/TranslatedText';
import SkeletonCard from '@/components/openappstore/SkeletonCard';
import { useUpdate } from '@/ctx/UpdateContext';
import {
  TAXONOMY_CATEGORIES,
  SCENE_COLLECTIONS,
  PLATFORM_LIST,
  type SceneCollection,
} from '@/constants/catalogTaxonomy';

const ORANGE = '#FA8C16';

// ─── 数据请求 ────────────────────────────────────────────────────────────────
async function fetchApps(body: Record<string, unknown>): Promise<AppItem[]> {
  const { data, error } = await supabase.functions.invoke('search-catalog', { body });
  if (error) {
    const msg = await error?.context?.text?.().catch(() => '');
    throw new Error(msg || error.message || '加载失败');
  }
  return Array.isArray(data?.data) ? data.data : [];
}

// 生成随机页码（1-20），确保每次换一批都不同
function randomPage(): number {
  return Math.floor(Math.random() * 20) + 1;
}

// ─── 今日推荐组件 ─────────────────────────────────────────────────────────────
function TodaySection() {
  const router = useRouter();
  const [apps, setApps]     = useState<AppItem[]>([]);
  const [loading, setLoading] = useState(true);
  const loadedRef = useRef(false);

  const doLoad = useCallback(async (page: number) => {
    setLoading(true);
    try {
      // sort=updated + 随机页偏移，每次换一批都能拿到不同的应用
      const items = await fetchApps({
        sort: 'updated', page, per_page: 8, _ts: Date.now(),
      });
      setApps(items);
    } catch { /* 忽略 */ }
    finally { setLoading(false); }
  }, []);

  // 首次进入加载，后续聚焦不重复请求
  useFocusEffect(useCallback(() => {
    if (!loadedRef.current) {
      loadedRef.current = true;
      doLoad(randomPage());
    }
  }, [doLoad]));

  const refresh = () => {
    loadedRef.current = true; // 阻止 useFocusEffect 再次触发
    doLoad(randomPage());
  };

  return (
    <View style={{ marginHorizontal: 12, marginBottom: 20 }}>
      {/* 标题行 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: '#FFF3E0',
            alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="sparkles" size={18} color={ORANGE} />
          </View>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#1A1A1A' }}>今日推荐</Text>
        </View>
        <Pressable onPress={refresh} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="refresh" size={14} color="#999" />
          <Text style={{ fontSize: 13, color: '#999' }}>换一批</Text>
        </Pressable>
      </View>

      {/* 卡片横向滑动 —— loading 时渲染同尺寸骨架卡，避免高度跳变 */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 10, paddingRight: 4 }}>
        {loading
          ? [0,1,2,3,4].map((i) => (
              <View key={i} style={{ width: 156, borderRadius: 16, padding: 14, backgroundColor: '#fff',
                boxShadow: [{ offsetX: 0, offsetY: 2, blurRadius: 10, color: 'rgba(0,0,0,0.06)' }] }}>
                {/* 图标 + 名称行骨架 */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: '#EFEFEF' }} />
                  <View style={{ flex: 1, gap: 5 }}>
                    <View style={{ height: 12, borderRadius: 6, backgroundColor: '#EFEFEF', width: '80%' }} />
                    <View style={{ height: 10, borderRadius: 5, backgroundColor: '#F5F5F5', width: '55%' }} />
                  </View>
                </View>
                {/* 描述骨架（3行） */}
                <View style={{ gap: 5 }}>
                  <View style={{ height: 10, borderRadius: 5, backgroundColor: '#EFEFEF', width: '100%' }} />
                  <View style={{ height: 10, borderRadius: 5, backgroundColor: '#F5F5F5', width: '90%' }} />
                  <View style={{ height: 10, borderRadius: 5, backgroundColor: '#F5F5F5', width: '70%' }} />
                </View>
                {/* Stars 行骨架 */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}>
                  <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: '#EFEFEF' }} />
                  <View style={{ height: 10, borderRadius: 5, backgroundColor: '#EFEFEF', width: 36 }} />
                </View>
              </View>
            ))
          : apps.map((app) => (
              <Pressable key={app.id}
                onPress={() => router.push({ pathname: `/detail/${app.id}`,
                  params: { owner: app.owner, repo: app.repo } } as any)}
                style={{ width: 156, backgroundColor: '#fff', borderRadius: 16, padding: 14,
                  boxShadow: [{ offsetX: 0, offsetY: 2, blurRadius: 10, color: 'rgba(0,0,0,0.08)' }] }}>
                {/* 图标 + 名称同行 */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <AppIcon owner={app.owner} url={app.avatar_url} name={app.name} size={40} priority="high" />
                  <Text style={{ flex: 1, fontSize: 13, fontWeight: '700', color: '#1A1A1A' }}
                    numberOfLines={2}>{app.name}</Text>
                </View>
                {/* 描述 */}
                {app.description ? (
                  <TranslatedText style={{ fontSize: 11, color: '#777', lineHeight: 16 }} numberOfLines={3}>
                    {app.description}
                  </TranslatedText>
                ) : (
                  <Text style={{ fontSize: 11, color: '#AAA' }} numberOfLines={1}>{app.repo}</Text>
                )}
                {/* Stars + 语言 */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}>
                  <Ionicons name="star" size={11} color="#FFAA00" />
                  <Text style={{ fontSize: 11, color: '#AAA', flex: 1 }}>
                    {app.stars >= 1000 ? `${(app.stars / 1000).toFixed(1)}k` : String(app.stars)}
                  </Text>
                  {app.language ? (
                    <Text style={{ fontSize: 10, color: '#BBB' }}>{app.language}</Text>
                  ) : null}
                </View>
              </Pressable>
            ))
        }
      </ScrollView>
    </View>
  );
}

// ─── 场景合集组件 ─────────────────────────────────────────────────────────────
function CollectionsSection() {
  const router = useRouter();
  return (
    <View style={{ marginHorizontal: 12, marginBottom: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: '#EBF3FF', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="layers" size={18} color="#1677FF" />
        </View>
        <Text style={{ fontSize: 16, fontWeight: '700', color: '#1A1A1A' }}>场景合集</Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {SCENE_COLLECTIONS.map((col: SceneCollection) => (
          <Pressable key={col.key}
            onPress={() => router.push({
              pathname: '/(tabs)/discover',
              params: { topics: col.topics.join(','), sort: col.sort },
            } as any)}
            style={{ width: '47%', backgroundColor: col.bg, borderRadius: 16, padding: 14,
              boxShadow: [{ offsetX: 0, offsetY: 2, blurRadius: 6, color: 'rgba(0,0,0,0.05)' }] }}>
            <Ionicons name={col.icon as any} size={24} color={col.color} style={{ marginBottom: 8 }} />
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#1A1A1A' }}>{col.title}</Text>
            <Text style={{ fontSize: 11, color: '#777', marginTop: 3 }}>{col.subtitle}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ─── 平台入口组件 ─────────────────────────────────────────────────────────────
function PlatformsSection() {
  const router = useRouter();
  return (
    <View style={{ marginHorizontal: 12, marginBottom: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="phone-portrait" size={18} color="#3DDC84" />
        </View>
        <Text style={{ fontSize: 16, fontWeight: '700', color: '#1A1A1A' }}>按平台浏览</Text>
      </View>
      {/* 与 CategoryGrid 统一：图标圆形容器 + 文字，无独立卡片阴影 */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {PLATFORM_LIST.map((p) => (
          <Pressable key={p.key}
            onPress={() => router.push({
              pathname: '/(tabs)/discover',
              params: { platform: p.key },
            } as any)}
            style={{ alignItems: 'center', gap: 6, flex: 1, paddingVertical: 6 }}>
            <View style={{ width: 52, height: 52, borderRadius: 15, backgroundColor: p.bg,
              alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={p.icon as any} size={26} color={p.color} />
            </View>
            <Text style={{ fontSize: 11, color: '#555', textAlign: 'center' }}>{p.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ─── 分类宫格组件 ─────────────────────────────────────────────────────────────
function CategoryGrid() {
  const router = useRouter();
  return (
    <View style={{ marginHorizontal: 12, marginBottom: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: '#F3E5F5', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="grid" size={18} color="#9C27B0" />
        </View>
        <Text style={{ fontSize: 16, fontWeight: '700', color: '#1A1A1A' }}>按类型发现</Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {TAXONOMY_CATEGORIES.map((cat) => (
          <Pressable key={cat.key}
            onPress={() => router.push({
              pathname: '/(tabs)/discover',
              params: { topics: cat.topics.join(',') },
            } as any)}
            style={{ width: '25%', alignItems: 'center', paddingVertical: 10, gap: 6 }}>
            <View style={{ width: 52, height: 52, borderRadius: 15, backgroundColor: cat.bg,
              alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={cat.icon as any} size={24} color={cat.color} />
            </View>
            <Text style={{ fontSize: 11, color: '#555', textAlign: 'center' }}>{cat.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ─── 最新发布标题行（只渲染标题，数据由外层 FlatList 驱动） ──────────────────
function LatestSectionHeader() {
  return (
    <View style={{ marginHorizontal: 12, marginBottom: 10, marginTop: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="time" size={18} color="#00897B" />
        </View>
        <Text style={{ fontSize: 16, fontWeight: '700', color: '#1A1A1A' }}>最新发布</Text>
      </View>
    </View>
  );
}

// ─── 主页面 ───────────────────────────────────────────────────────────────────
export default function HomeTab() {
  const router = useRouter();
  const { pendingCount } = useUpdate();
  useAndroidExitBack();

  // 最新发布数据状态（提升至顶层，让外层 FlatList 的 onEndReached 驱动自动加载）
  const [latestApps, setLatestApps]       = useState<AppItem[]>([]);
  const [latestLoading, setLatestLoading] = useState(true);
  const [latestMore, setLatestMore]       = useState(false);
  const [latestLoadingMore, setLatestLoadingMore] = useState(false);
  const latestPageRef  = useRef(1);
  const latestBusyRef  = useRef(false);
  const lastLoadedAtRef = useRef(0);

  const loadLatest = useCallback(async (p: number) => {
    if (latestBusyRef.current) return;
    latestBusyRef.current = true;
    if (p === 1) setLatestLoading(true); else setLatestLoadingMore(true);
    try {
      const items = await fetchApps({ sort: 'updated', page: p, per_page: 20, _ts: Date.now() });
      if (p === 1) setLatestApps(items); else setLatestApps((prev) => [...prev, ...items]);
      latestPageRef.current = p;
      setLatestMore(items.length === 20);
      if (p === 1) lastLoadedAtRef.current = Date.now();
    } catch { /* 忽略 */ }
    finally {
      setLatestLoading(false);
      setLatestLoadingMore(false);
      latestBusyRef.current = false;
    }
  }, []);

  useFocusEffect(useCallback(() => {
    const STALE_MS = 60_000;
    if (Date.now() - lastLoadedAtRef.current > STALE_MS) {
      latestPageRef.current = 1;
      loadLatest(1);
    }
  }, [loadLatest]));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F6F8' }} edges={['top']}>
      <FlatList
        data={latestApps}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <AppCard app={item} />}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (lastLoadedAtRef.current > 0 && !latestBusyRef.current && latestMore) {
            loadLatest(latestPageRef.current + 1);
          }
        }}
        contentContainerStyle={{ paddingBottom: 32 }}
        ListHeaderComponent={
          <View>
            {/* 搜索栏 + 通知 + 头像 */}
            <View style={{ flexDirection: 'row', alignItems: 'center',
              paddingHorizontal: 12, paddingTop: 8, paddingBottom: 12, gap: 8 }}>
              <Pressable
                onPress={() => router.push('/(tabs)/search' as any)}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
                  borderRadius: 24, paddingHorizontal: 14, paddingVertical: 11, gap: 6,
                  boxShadow: [{ offsetX: 0, offsetY: 1, blurRadius: 3, color: 'rgba(0,0,0,0.06)' }] }}>
                <Ionicons name="search-outline" size={16} color="#AAAAAA" />
                <Text style={{ color: '#AAAAAA', fontSize: 14 }}>搜索开源应用…</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push({ pathname: '/downloads' as any, params: { tab: 'installed' } })}
                style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff',
                  alignItems: 'center', justifyContent: 'center',
                  boxShadow: [{ offsetX: 0, offsetY: 1, blurRadius: 3, color: 'rgba(0,0,0,0.06)' }] }}>
                <Ionicons name="notifications-outline" size={20} color={pendingCount > 0 ? ORANGE : '#555'} />
                {pendingCount > 0 && (
                  <View style={{ position: 'absolute', top: 6, right: 6, minWidth: 16, height: 16,
                    borderRadius: 8, backgroundColor: '#FF4D4F', alignItems: 'center',
                    justifyContent: 'center', paddingHorizontal: 3, borderWidth: 1.5, borderColor: '#fff' }}>
                    <Text style={{ fontSize: 9, color: '#fff', fontWeight: '700', lineHeight: 11 }}>
                      {pendingCount > 99 ? '99+' : pendingCount}
                    </Text>
                  </View>
                )}
              </Pressable>
              <Pressable
                onPress={() => router.push('/(tabs)/profile' as any)}
                style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#EBF3FF',
                  alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#1677FF' }}>
                <Ionicons name="logo-github" size={20} color="#1677FF" />
              </Pressable>
            </View>

            {/* 各内容区块 */}
            <TodaySection />
            <CollectionsSection />
            <PlatformsSection />
            <CategoryGrid />

            {/* 最新发布标题 + 骨架屏（首次加载时） */}
            <LatestSectionHeader />
            {latestLoading && (
              <View style={{ marginHorizontal: 12 }}>
                {[1,2,3].map((i) => <SkeletonCard key={i} />)}
              </View>
            )}
          </View>
        }
        ListFooterComponent={
          latestLoadingMore
            ? <View style={{ paddingVertical: 16 }}><ActivityIndicator color="#1677FF" /></View>
            : latestMore
              ? <View style={{ paddingVertical: 12, alignItems: 'center' }}><Text style={{ color: '#CCC', fontSize: 12 }}>上滑加载更多</Text></View>
              : latestApps.length > 0
                ? <View style={{ paddingVertical: 16, alignItems: 'center' }}><Text style={{ color: '#CCC', fontSize: 12 }}>— 已显示全部 —</Text></View>
                : null
        }
      />
    </SafeAreaView>
  );
}

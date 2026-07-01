import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, FlatList, ActivityIndicator, ScrollView } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useAndroidExitBack } from '@/hooks/useAndroidExitBack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/client/supabase';
import { clearAllCache } from '@/lib/cache';
import type { AppItem } from '@/types';
import AppCard from '@/components/openappstore/AppCard';
import SkeletonCard from '@/components/openappstore/SkeletonCard';
import { useTranslation } from '@/ctx/TranslationContext';
import { translateBatch } from '@/lib/translateApi';
import {
  TAXONOMY_CATEGORIES,
  PLATFORM_LIST,
  LANGUAGE_LIST,
  STARS_FILTERS,
  SORT_OPTIONS,
} from '@/constants/catalogTaxonomy';

// 全部类别选项（含"全部"）
const CATEGORY_OPTIONS = [{ key: '全部', label: '全部', topics: [] as string[] }, ...TAXONOMY_CATEGORIES];

// 安装包筛选
const INSTALL_OPTIONS = [
  { key: 'all',      label: '全部' },
  { key: 'has_only', label: '有安装包' },
];

export default function DiscoverTab() {
  useAndroidExitBack();
  const params = useLocalSearchParams();
  const { enabled: translateEnabled, targetLang } = useTranslation();

  // 筛选状态
  const [platform,      setPlatform]      = useState<string>('全平台');
  const [categoryKey,   setCategoryKey]   = useState<string>('全部');
  const [language,      setLanguage]      = useState<string>('全部');
  const [starsKey,      setStarsKey]      = useState<string>('any');
  const [installFilter, setInstallFilter] = useState<string>('has_only');
  const [sort,          setSort]          = useState<string>('stars');

  // 数据状态
  const [apps,        setApps]        = useState<AppItem[]>([]);
  // id → 翻译后的 description（批量翻译完成后填充）
  const [descMap,     setDescMap]     = useState<Map<number, string>>(new Map());
  // 已翻译 id 集合，避免加载更多时重复翻译已有条目
  const translatedIdsRef = useRef<Set<number>>(new Set());
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing,  setRefreshing]  = useState(false);
  const [hasMore,     setHasMore]     = useState(false);
  const [error,       setError]       = useState<string>('');
  const loadingRef       = useRef(false);
  const pageRef          = useRef(1);
  const lastLoadedAtRef  = useRef(0);

  // 接收来自首页/场景合集的导航参数（只在首次挂载时读取）
  const initRef = useRef(false);

  const loadData = useCallback(async (
    pageNum = 1, isRefresh = false,
    p = platform, catKey = categoryKey, lang = language,
    sk = starsKey, inst = installFilter, s = sort,
  ) => {
    if (loadingRef.current && !isRefresh) return;
    loadingRef.current = true;
    setError('');
    if (isRefresh) setRefreshing(true);
    else if (pageNum === 1) setLoading(true);
    else setLoadingMore(true);

    try {
      const catTopics = CATEGORY_OPTIONS.find((c) => c.key === catKey)?.topics ?? [];
      const minStars  = STARS_FILTERS.find((f) => f.key === sk)?.value ?? 0;

      const body: Record<string, unknown> = {
        sort: s, page: pageNum, per_page: 20, _ts: Date.now(),
        has_installable_assets: inst === 'has_only',
      };
      if (p !== '全平台')    body.platform   = p;
      if (lang !== '全部')   body.language   = lang;
      if (minStars > 0)       body.min_stars  = minStars;
      if (catTopics.length)   body.topics     = catTopics;

      const { data, error: fnErr } = await supabase.functions.invoke('search-catalog', { body });
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
      if (pageNum === 1) lastLoadedAtRef.current = Date.now();
    }
  }, [platform, categoryKey, language, starsKey, installFilter, sort]);

  // ── 批量翻译：独立 effect，避免 loadData 闭包陷阱 ────────────────────────────
  // loadData 的 useCallback 依赖不含 translateEnabled/targetLang，
  // 若把翻译逻辑写在 loadData 内部，开关翻译后永远读到旧的 false 值。
  // 改为独立 effect 监听 apps / translateEnabled / targetLang，每次变化时
  // 只翻译尚未翻译的条目（translatedIdsRef 追踪），加载更多不重复翻译。
  useEffect(() => {
    if (!translateEnabled || !apps.length) return;
    const pending = apps.filter(
      (a) => !translatedIdsRef.current.has(a.id) && a.description,
    );
    if (!pending.length) return;

    const descs = pending.map((a) => a.description || '');
    translateBatch(descs, targetLang)
      .then((translated) => {
        pending.forEach((a) => translatedIdsRef.current.add(a.id));
        setDescMap((prev) => {
          const next = new Map(prev);
          pending.forEach((a, i) => {
            next.set(a.id, translated[i] ?? a.description ?? '');
          });
          return next;
        });
      })
      .catch(() => {});
  }, [apps, translateEnabled, targetLang]);

  // 翻译关闭时清空 descMap，AppCard 自动回退到原文
  useEffect(() => {
    if (!translateEnabled) {
      setDescMap(new Map());
      translatedIdsRef.current = new Set();
    }
  }, [translateEnabled]);

  const handleClearCacheAndReload = async () => {
    await clearAllCache();
    lastLoadedAtRef.current = 0;
    pageRef.current = 1;
    setApps([]);
    setDescMap(new Map());
    translatedIdsRef.current = new Set();
    setHasMore(false);
    loadData(1, false);
  };

  // 接收导航参数并更新筛选条件
  useFocusEffect(useCallback(() => {
    const paramPlatform = typeof params.platform === 'string' ? params.platform : null;
    const paramTopics   = typeof params.topics   === 'string' ? params.topics   : null;
    const paramSort     = typeof params.sort     === 'string' ? params.sort     : null;

    let newPlatform    = platform;
    let newCategoryKey = categoryKey;
    let newSort        = sort;

    if (paramPlatform) { newPlatform = paramPlatform; setPlatform(paramPlatform); }
    if (paramTopics) {
      // 找出 topics 匹配的分类 key（来自合集入口传入的 topics 字符串）
      const topicArr = paramTopics.split(',');
      const matched  = TAXONOMY_CATEGORIES.find(
        (c) => topicArr.some((t) => c.topics.includes(t))
      );
      if (matched) { newCategoryKey = matched.key; setCategoryKey(matched.key); }
    }
    if (paramSort) { newSort = paramSort; setSort(paramSort); }

    const STALE_MS = 60_000;
    const filtersChanged = paramPlatform || paramTopics || paramSort;
    const isStale = Date.now() - lastLoadedAtRef.current > STALE_MS;

    if (filtersChanged || isStale) {
      pageRef.current = 1;
      setApps([]);
      setHasMore(false);
      loadData(1, false, newPlatform, newCategoryKey, language, starsKey, installFilter, newSort);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.platform, params.topics, params.sort]));

  const reset = (
    p: string, catKey: string, lang: string,
    sk: string, inst: string, s: string,
  ) => {
    setPlatform(p); setCategoryKey(catKey); setLanguage(lang);
    setStarsKey(sk); setInstallFilter(inst); setSort(s);
    pageRef.current = 1;
    setApps([]);
    setDescMap(new Map());
    translatedIdsRef.current = new Set();
    setHasMore(false);
    loadData(1, false, p, catKey, lang, sk, inst, s);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F6F8' }} edges={['top']}>
      <FlatList
        data={apps}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <AppCard app={item} descOverride={descMap.get(item.id)} />}
        onRefresh={() => { pageRef.current = 1; loadData(1, true); }}
        refreshing={refreshing}
        onEndReached={() => {
          if (lastLoadedAtRef.current > 0 && !loadingRef.current && hasMore) {
            const n = pageRef.current + 1;
            loadData(n);
          }
        }}
        onEndReachedThreshold={0.5}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListHeaderComponent={
          <View>
            {/* 标题 */}
            <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 }}>
              <Text style={{ fontSize: 22, fontWeight: '700', color: '#1A1A1A' }}>发现</Text>
              <Text style={{ fontSize: 12, color: '#AAA', marginTop: 2 }}>探索开源应用目录</Text>
            </View>

            {/* 平台筛选 */}
            <FilterRowLabel label="平台" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 6, gap: 8 }}>
              {[{ key: '全平台', label: '全平台', icon: 'grid-outline', color: '#1677FF' }, ...PLATFORM_LIST.map((p) => ({ ...p, label: p.label }))].map((p) => {
                const active = platform === p.key;
                return (
                  <Pressable key={p.key} onPress={() => reset(p.key, categoryKey, language, starsKey, installFilter, sort)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 5,
                      paddingHorizontal: 13, paddingVertical: 7, borderRadius: 20,
                      borderWidth: 1.5, borderColor: active ? '#1677FF' : '#E0E0E0',
                      backgroundColor: active ? '#EBF3FF' : '#fff' }}>
                    <Ionicons name={p.icon as any} size={14} color={active ? '#1677FF' : '#999'} />
                    <Text style={{ fontSize: 13, fontWeight: '500', color: active ? '#1677FF' : '#333' }}>{p.key}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* 分类筛选 */}
            <FilterRowLabel label="类型" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 6, gap: 8 }}>
              {CATEGORY_OPTIONS.map((c) => {
                const active = categoryKey === c.key;
                return (
                  <Pressable key={c.key} onPress={() => reset(platform, c.key, language, starsKey, installFilter, sort)}
                    style={{ paddingHorizontal: 13, paddingVertical: 6, borderRadius: 16,
                      backgroundColor: active ? '#1677FF' : '#F0F0F0' }}>
                    <Text style={{ fontSize: 13, fontWeight: active ? '600' : '400',
                      color: active ? '#fff' : '#555' }}>{c.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* 编程语言筛选 */}
            <FilterRowLabel label="语言" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 6, gap: 8 }}>
              {LANGUAGE_LIST.map((lang) => {
                const active = language === lang;
                return (
                  <Pressable key={lang} onPress={() => reset(platform, categoryKey, lang, starsKey, installFilter, sort)}
                    style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14,
                      borderWidth: 1, borderColor: active ? '#9C27B0' : '#E0E0E0',
                      backgroundColor: active ? '#F3E5F5' : '#fff' }}>
                    <Text style={{ fontSize: 12, color: active ? '#9C27B0' : '#666',
                      fontWeight: active ? '600' : '400' }}>{lang}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Stars 门槛 + 安装包筛选 */}
            <FilterRowLabel label="质量" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 6, gap: 8 }}>
              {STARS_FILTERS.map((f) => {
                const active = starsKey === f.key;
                return (
                  <Pressable key={f.key} onPress={() => reset(platform, categoryKey, language, f.key, installFilter, sort)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4,
                      paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14,
                      borderWidth: 1, borderColor: active ? '#FFAA00' : '#E0E0E0',
                      backgroundColor: active ? '#FFFDE7' : '#fff' }}>
                    {active && <Ionicons name="star" size={11} color="#FFAA00" />}
                    <Text style={{ fontSize: 12, color: active ? '#E65100' : '#666',
                      fontWeight: active ? '600' : '400' }}>{f.label}</Text>
                  </Pressable>
                );
              })}
              {INSTALL_OPTIONS.map((opt) => {
                const active = installFilter === opt.key;
                return (
                  <Pressable key={opt.key} onPress={() => reset(platform, categoryKey, language, starsKey, opt.key, sort)}
                    style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14,
                      borderWidth: 1, borderColor: active ? '#00897B' : '#E0E0E0',
                      backgroundColor: active ? '#E0F2F1' : '#fff' }}>
                    <Text style={{ fontSize: 12, color: active ? '#00695C' : '#666',
                      fontWeight: active ? '600' : '400' }}>{opt.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* 排序 */}
            <FilterRowLabel label="排序" />
            <View style={{ flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 10, gap: 8, flexWrap: 'wrap' }}>
              {SORT_OPTIONS.map((s) => {
                const active = sort === s.key;
                return (
                  <Pressable key={s.key} onPress={() => reset(platform, categoryKey, language, starsKey, installFilter, s.key)}
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
          (loading || lastLoadedAtRef.current === 0)
            ? <View style={{ padding: 16 }}>{[1,2,3,4].map((i) => <SkeletonCard key={i} />)}</View>
            : <View style={{ alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 }}>
                <View style={{ width: 80, height: 80, borderRadius: 80,
                  backgroundColor: error ? '#FFF2F0' : '#F5F5F5',
                  alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <Ionicons name={error ? 'alert-circle-outline' : 'compass-outline'} size={40} color={error ? '#FF4D4F' : '#CCC'} />
                </View>
                {error ? (
                  <>
                    <Text style={{ color: '#FF4D4F', fontSize: 14, textAlign: 'center', marginBottom: 12 }}>{error}</Text>
                    <Pressable onPress={handleClearCacheAndReload}
                      style={{ paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#1677FF', borderRadius: 20 }}>
                      <Text style={{ color: '#fff', fontWeight: '600' }}>清除缓存并重试</Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <Text style={{ color: '#AAA', fontSize: 15, textAlign: 'center' }}>暂无数据</Text>
                    <Text style={{ color: '#CCC', fontSize: 13, textAlign: 'center', marginTop: 4 }}>下拉刷新或切换筛选条件</Text>
                    <Pressable onPress={handleClearCacheAndReload}
                      style={{ marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#F5F5F5', borderRadius: 20 }}>
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

// 筛选行标签
function FilterRowLabel({ label }: { label: string }) {
  return (
    <Text style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 2,
      fontSize: 11, fontWeight: '600', color: '#AAA', textTransform: 'uppercase', letterSpacing: 0.5 }}>
      {label}
    </Text>
  );
}

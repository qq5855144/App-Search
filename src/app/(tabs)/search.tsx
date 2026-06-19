import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, TextInput, Pressable, FlatList,
  ScrollView, ActivityIndicator, Modal,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, X, SlidersHorizontal, Flame, ChevronDown, Check, RefreshCw } from 'lucide-react-native';
import { addSearchHistory, clearSearchHistory, getSearchHistory } from '@/lib/database';
import { addAppEvent, uploadPendingEventsToTrack } from '@/lib/events';
import { useAndroidExitBack } from '@/hooks/useAndroidExitBack';
import { smartSearch } from '@/lib/github';
import { supabase } from '@/client/supabase';
import type { AppItem } from '@/types';
import AppCard from '@/components/openappstore/AppCard';

// ─── 常量 ────────────────────────────────────────────────────────────────────
const BLOCKED_PATTERNS = [
  /色情|裸体|黄片|成人片|约炮|嫖娼/i,
  /\b(porn|nude|xxx|sex(?:ual)?|av\b)/i,
  /赌博|赌场|博彩/i,
  /毒品|大麻|冰毒|海洛因|可卡因/i,
  /\b(drug|weed|cocaine)\b/i,
  /炸弹|枪支|暗网|杀人教程/i,
];

const PLATFORMS = ['全平台', 'Android', 'iOS', 'Windows', 'macOS', 'Linux'];
const LANGUAGES = ['全部', 'TypeScript', 'JavaScript', 'Kotlin', 'Swift', 'Dart', 'Python', 'Go', 'Rust', 'Java', 'C++', 'C#'];
const SORT_OPTIONS: { label: string; value: string }[] = [
  { label: 'Stars 最多', value: 'stars' },
  { label: '最近更新', value: 'updated' },
  { label: 'Forks 最多', value: 'forks' },
  { label: '下载最多', value: 'downloads' },
];
const MIN_STARS_OPTIONS = [
  { label: '不限', value: 0 },
  { label: '100+', value: 100 },
  { label: '1k+', value: 1000 },
  { label: '5k+', value: 5000 },
  { label: '10k+', value: 10000 },
];

function isSafeKeyword(kw: string): boolean {
  return !BLOCKED_PATTERNS.some((re) => re.test(kw));
}

// ─── 筛选状态类型 ────────────────────────────────────────────────────────────
interface FilterState {
  platform: string;
  language: string;
  minStars: number;
  sort: string;
  hasAssets: boolean;
}

const DEFAULT_FILTERS: FilterState = {
  platform: '全平台',
  language: '全部',
  minStars: 0,
  sort: 'stars',
  hasAssets: true,
};

function filtersActive(f: FilterState): boolean {
  return (
    f.platform !== '全平台' ||
    f.language !== '全部' ||
    f.minStars > 0 ||
    f.sort !== 'stars' ||
    !f.hasAssets
  );
}

// ─── 主组件 ──────────────────────────────────────────────────────────────────
export default function SearchTab() {
  useAndroidExitBack();
  const inputRef = useRef<TextInput>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const searchIdRef = useRef(0);
  const loadingRef = useRef(false);
  const lastKeywordRef = useRef('');

  const [inputValue, setInputValue] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [hotWords, setHotWords] = useState<string[]>([]);
  const [results, setResults] = useState<AppItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  // 高级筛选
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [pendingFilters, setPendingFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [filterVisible, setFilterVisible] = useState(false);

  const loadHistory = useCallback(async () => {
    try { setHistory(await getSearchHistory()); } catch { /* ignore */ }
  }, []);

  const loadHotWords = useCallback(async () => {
    try {
      const { data, error: rpcErr } = await supabase.rpc('get_hot_keywords', { limit_n: 20 });
      if (!rpcErr && Array.isArray(data) && data.length > 0) {
        const words = (data as { keyword: string; cnt: number }[])
          .map((r) => r.keyword).filter(isSafeKeyword);
        if (words.length > 0) { setHotWords(words); return; }
      }
    } catch { /* 降级 */ }
    try {
      const { getPopularKeywords } = await import('@/lib/events');
      const kws = await getPopularKeywords(20);
      if (kws.length > 0) setHotWords(kws.map((k) => k.keyword).filter(isSafeKeyword));
    } catch { /* 静默失败 */ }
  }, []);

  useFocusEffect(useCallback(() => {
    loadHistory();
    loadHotWords();
  }, [loadHistory, loadHotWords]));

  // ── 执行搜索 ────────────────────────────────────────────────────────────────
  const performSearch = useCallback(async (
    kw: string,
    pageNum = 1,
    isLoadMore = false,
    activeFilters = filters,
  ) => {
    const k = kw.trim();
    if (!k) return;
    if (!isLoadMore && loadingRef.current) return;

    if (!isSafeKeyword(k)) {
      setSearched(true);
      setLoading(false);
      setError('搜索内容包含不安全词汇');
      setResults([]);
      return;
    }

    // 取消上一次请求
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    inputRef.current?.blur();
    const thisSearchId = ++searchIdRef.current;

    if (!isLoadMore) {
      try { addSearchHistory(k).then(loadHistory); } catch { /* ignore */ }
      addAppEvent({ event_type: 'search', keyword: k })
        .then(() => uploadPendingEventsToTrack()).catch(() => {});

      lastKeywordRef.current = k;
      setSearched(true);
      setLoading(true);
      setError('');
      setResults([]);
      setPage(1);
      setHasMore(false);
      setTotalCount(0);
    } else {
      setLoadingMore(true);
    }

    loadingRef.current = true;

    try {
      const { items, total_count, has_more } = await smartSearch(k, {
        sort: activeFilters.sort,
        order: 'desc',
        page: pageNum,
        per_page: 30,
      });
      if (searchIdRef.current !== thisSearchId) return;

      setTotalCount(total_count);
      setHasMore(has_more);
      setPage(pageNum);

      if (isLoadMore) {
        setResults((prev) => {
          const ids = new Set(prev.map((a) => a.id));
          return [...prev, ...items.filter((a) => !ids.has(a.id))];
        });
      } else {
        setResults(items);
      }

      loadHotWords();
    } catch (e: any) {
      if (searchIdRef.current !== thisSearchId) return;
      if (!isLoadMore) {
        setError('搜索暂不可用：' + (e?.message || '网络错误'));
      }
    } finally {
      if (searchIdRef.current === thisSearchId) {
        setLoading(false);
        setLoadingMore(false);
        loadingRef.current = false;
      }
    }
  }, [filters, loadHistory, loadHotWords]);

  // ── 防抖输入 ────────────────────────────────────────────────────────────────
  const handleInputChange = (text: string) => {
    setInputValue(text);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (text.trim().length >= 2) {
      debounceTimer.current = setTimeout(() => {
        performSearch(text);
      }, 300);
    }
  };

  const handleLoadMore = () => {
    if (loadingRef.current || !hasMore || loadingMore) return;
    loadingRef.current = true;
    performSearch(lastKeywordRef.current, page + 1, true);
  };

  const handleCancel = () => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (abortRef.current) abortRef.current.abort();
    searchIdRef.current++;
    setInputValue('');
    setSearched(false);
    setResults([]);
    setError('');
    setPage(1);
    setHasMore(false);
    setTotalCount(0);
    lastKeywordRef.current = '';
    loadingRef.current = false;
  };

  const handleClearFilters = () => {
    const reset = DEFAULT_FILTERS;
    setFilters(reset);
    setPendingFilters(reset);
    if (lastKeywordRef.current) performSearch(lastKeywordRef.current, 1, false, reset);
  };

  // ── 筛选面板 ────────────────────────────────────────────────────────────────
  const openFilter = () => { setPendingFilters(filters); setFilterVisible(true); };
  const applyFilter = () => {
    setFilterVisible(false);
    setFilters(pendingFilters);
    if (lastKeywordRef.current) performSearch(lastKeywordRef.current, 1, false, pendingFilters);
  };
  const cancelFilter = () => setFilterVisible(false);

  const isActive = filtersActive(filters);
  const sortLabel = SORT_OPTIONS.find((s) => s.value === filters.sort)?.label || 'Stars 最多';

  // ── 结果摘要文本 ─────────────────────────────────────────────────────────────
  const summaryParts: string[] = [];
  if (lastKeywordRef.current) summaryParts.push(`"${lastKeywordRef.current}"`);
  if (filters.platform !== '全平台') summaryParts.push(filters.platform);
  if (filters.language !== '全部') summaryParts.push(filters.language);
  if (filters.minStars > 0) {
    summaryParts.push(`${filters.minStars >= 1000 ? `${filters.minStars / 1000}k` : filters.minStars}+ stars`);
  }
  const summaryText = summaryParts.length > 0 ? summaryParts.join(' · ') : '';

  // ── 样式常量 ─────────────────────────────────────────────────────────────────
  const tagStyle = {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 18,
    borderWidth: 1, borderColor: '#E8E8E8', backgroundColor: '#fff',
  } as const;

  // ── 渲染 ──────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F5F5' }} edges={['top']}>
      {/* 搜索栏 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 10, gap: 8 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
          borderRadius: 10, paddingHorizontal: 10, height: 40, gap: 6 }}>
          <Search size={16} color="#AAA" />
          <TextInput
            ref={inputRef}
            style={{ flex: 1, fontSize: 15, color: '#1A1A1A' } as any}
            placeholder="搜索全部 GitHub 开源项目…"
            placeholderTextColor="#AAA"
            value={inputValue}
            onChangeText={handleInputChange}
            onSubmitEditing={(e) => {
              if (debounceTimer.current) clearTimeout(debounceTimer.current);
              performSearch(e.nativeEvent.text || inputValue);
            }}
            returnKeyType="search"
            underlineColorAndroid="transparent"
          />
          {inputValue.length > 0 && (
            <Pressable onPress={() => { setInputValue(''); }} hitSlop={8}>
              <X size={16} color="#AAA" />
            </Pressable>
          )}
        </View>

        {/* 筛选按钮 */}
        <Pressable
          onPress={openFilter}
          hitSlop={8}
          style={{
            width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
            backgroundColor: isActive ? '#1677FF' : '#fff',
          }}
        >
          <SlidersHorizontal size={18} color={isActive ? '#fff' : '#555'} />
          {isActive && (
            <View style={{
              position: 'absolute', top: 6, right: 6,
              width: 7, height: 7, borderRadius: 4,
              backgroundColor: '#FF4D00', borderWidth: 1.5, borderColor: '#fff',
            }} />
          )}
        </Pressable>

        {searched && (
          <Pressable onPress={handleCancel} hitSlop={8}>
            <Text style={{ color: '#1677FF', fontSize: 15 }}>取消</Text>
          </Pressable>
        )}
      </View>

      {/* 激活筛选条件标签栏 */}
      {isActive && (
        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 8, gap: 6, flexDirection: 'row' }}
        >
          {filters.platform !== '全平台' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#EAF2FF',
              borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, gap: 4 }}>
              <Text style={{ fontSize: 12, color: '#1677FF' }}>{filters.platform}</Text>
            </View>
          )}
          {filters.language !== '全部' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#EAF2FF',
              borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ fontSize: 12, color: '#1677FF' }}>{filters.language}</Text>
            </View>
          )}
          {filters.minStars > 0 && (
            <View style={{ backgroundColor: '#EAF2FF', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ fontSize: 12, color: '#1677FF' }}>
                {filters.minStars >= 1000 ? `${filters.minStars / 1000}k` : filters.minStars}+ ⭐
              </Text>
            </View>
          )}
          {filters.sort !== 'stars' && (
            <View style={{ backgroundColor: '#EAF2FF', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ fontSize: 12, color: '#1677FF' }}>{sortLabel}</Text>
            </View>
          )}
          <Pressable
            onPress={handleClearFilters}
            style={{ backgroundColor: '#FFF2F0', borderRadius: 12, paddingHorizontal: 10,
              paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 3 }}
          >
            <X size={11} color="#FF4D4F" />
            <Text style={{ fontSize: 12, color: '#FF4D4F' }}>清除筛选</Text>
          </Pressable>
        </ScrollView>
      )}

      {/* ── 主内容区 ─────────────────────────────────────────── */}
      {!searched ? (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 20 }}>
          {history.length > 0 && (
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontWeight: '700', fontSize: 15 }}>搜索历史</Text>
                <Pressable onPress={async () => { await clearSearchHistory(); setHistory([]); }}>
                  <Text style={{ color: '#999', fontSize: 13 }}>清空</Text>
                </Pressable>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {history.map((h) => (
                  <Pressable key={h} onPress={() => performSearch(h)} style={tagStyle}>
                    <Text style={{ fontSize: 13, color: '#333' }}>{h}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontWeight: '700', fontSize: 15 }}>热门搜索</Text>
              <Flame size={14} color="#FF4D00" />
            </View>
            {hotWords.length === 0 ? (
              <Text style={{ fontSize: 13, color: '#BBB' }}>暂无热搜数据</Text>
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {hotWords.map((h) => (
                  <Pressable key={h} onPress={() => performSearch(h)} style={tagStyle}>
                    <Text style={{ fontSize: 13, color: '#333' }}>{h}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </ScrollView>

      ) : loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <ActivityIndicator color="#1677FF" size="large" />
          <Text style={{ fontSize: 13, color: '#AAA' }}>正在搜索…</Text>
        </View>

      ) : error && results.length === 0 ? (
        /* ── 错误状态 ── */
        <View style={{ margin: 16, padding: 16, borderRadius: 12, backgroundColor: '#FFF2F0',
          borderWidth: 1, borderColor: '#FFCCC7', gap: 10 }}>
          <Text style={{ color: '#d32f2f', fontSize: 14 }}>{error}</Text>
          <Pressable
            onPress={() => performSearch(lastKeywordRef.current)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
              backgroundColor: '#FF4D4F', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}
          >
            <RefreshCw size={14} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 13 }}>重试</Text>
          </Pressable>
        </View>

      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => String(item.id)}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => <AppCard app={item} />}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListHeaderComponent={
            <View style={{ paddingHorizontal: 16, paddingVertical: 8, gap: 6 }}>
              {/* 结果摘要 */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                <Text style={{ fontSize: 12, color: '#888', flex: 1 }}>
                  {summaryText ? `${summaryText}  ·  ` : ''}
                  共 {totalCount > 0 ? totalCount.toLocaleString() : results.length} 个项目
                  {filters.hasAssets ? '（已过滤无安装包）' : ''}
                </Text>
                <Text style={{ fontSize: 12, color: '#AAA' }}>
                  {sortLabel} · 显示 {results.length}
                </Text>
              </View>
            </View>
          }
          ListEmptyComponent={
            /* ── 空结果 ── */
            <View style={{ alignItems: 'center', paddingTop: 48, paddingHorizontal: 24, gap: 12 }}>
              <Search size={48} color="#CCC" />
              <Text style={{ color: '#888', fontSize: 15, fontWeight: '600' }}>未找到相关应用</Text>
              <Text style={{ color: '#BBB', fontSize: 13, textAlign: 'center' }}>
                试试以下操作：
              </Text>
              {isActive && (
                <Pressable
                  onPress={handleClearFilters}
                  style={{ backgroundColor: '#EAF2FF', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 }}
                >
                  <Text style={{ color: '#1677FF', fontSize: 13 }}>清除所有筛选条件</Text>
                </Pressable>
              )}
              <View style={{ gap: 6, width: '100%' }}>
                {[
                  '换一个更通用的关键词',
                  filters.platform !== '全平台' ? `切换为「全平台」` : null,
                  filters.minStars > 0 ? '降低最低 Stars 要求' : null,
                  '使用英文关键词搜索',
                ].filter(Boolean).map((tip) => (
                  <View key={tip as string} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
                    <Text style={{ color: '#DDD', fontSize: 14, marginTop: 1 }}>•</Text>
                    <Text style={{ fontSize: 13, color: '#AAA' }}>{tip}</Text>
                  </View>
                ))}
              </View>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: 16 }}><ActivityIndicator color="#1677FF" /></View>
            ) : hasMore ? (
              <View style={{ paddingVertical: 12, alignItems: 'center' }}>
                <Text style={{ color: '#BBB', fontSize: 12 }}>上滑加载更多</Text>
              </View>
            ) : results.length > 0 ? (
              <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                <Text style={{ color: '#CCC', fontSize: 12 }}>— 已显示全部结果 —</Text>
              </View>
            ) : null
          }
        />
      )}

      {/* ── 高级筛选 Modal ─────────────────────────────────────── */}
      <Modal visible={filterVisible} transparent animationType="slide" onRequestClose={cancelFilter}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' }}
          onPress={cancelFilter}
        />
        <View style={{
          backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
          paddingBottom: 36, paddingTop: 12, maxHeight: '85%',
        }}>
          {/* 把手 */}
          <View style={{ width: 36, height: 4, backgroundColor: '#E0E0E0', borderRadius: 2, alignSelf: 'center', marginBottom: 12 }} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 16 }}>
            <Text style={{ fontSize: 17, fontWeight: '700' }}>高级筛选</Text>
            <Pressable onPress={() => setPendingFilters(DEFAULT_FILTERS)}>
              <Text style={{ color: '#1677FF', fontSize: 14 }}>重置</Text>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 22 }}>

            {/* 平台 */}
            <FilterSection title="平台">
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {PLATFORMS.map((p) => (
                  <Pressable
                    key={p}
                    onPress={() => setPendingFilters((f) => ({ ...f, platform: p }))}
                    style={{
                      paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18,
                      backgroundColor: pendingFilters.platform === p ? '#1677FF' : '#F5F5F5',
                    }}
                  >
                    <Text style={{ fontSize: 13, color: pendingFilters.platform === p ? '#fff' : '#333' }}>{p}</Text>
                  </Pressable>
                ))}
              </View>
            </FilterSection>

            {/* 编程语言 */}
            <FilterSection title="编程语言">
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {LANGUAGES.map((l) => (
                  <Pressable
                    key={l}
                    onPress={() => setPendingFilters((f) => ({ ...f, language: l }))}
                    style={{
                      paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18,
                      backgroundColor: pendingFilters.language === l ? '#1677FF' : '#F5F5F5',
                    }}
                  >
                    <Text style={{ fontSize: 13, color: pendingFilters.language === l ? '#fff' : '#333' }}>{l}</Text>
                  </Pressable>
                ))}
              </View>
            </FilterSection>

            {/* 最低 Stars */}
            <FilterSection title="最低 Stars">
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {MIN_STARS_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.value}
                    onPress={() => setPendingFilters((f) => ({ ...f, minStars: opt.value }))}
                    style={{
                      paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18,
                      backgroundColor: pendingFilters.minStars === opt.value ? '#1677FF' : '#F5F5F5',
                    }}
                  >
                    <Text style={{ fontSize: 13, color: pendingFilters.minStars === opt.value ? '#fff' : '#333' }}>{opt.label}</Text>
                  </Pressable>
                ))}
              </View>
            </FilterSection>

            {/* 排序 */}
            <FilterSection title="排序方式">
              <View style={{ gap: 8 }}>
                {SORT_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.value}
                    onPress={() => setPendingFilters((f) => ({ ...f, sort: opt.value }))}
                    style={{
                      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                      paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10,
                      backgroundColor: pendingFilters.sort === opt.value ? '#EAF2FF' : '#F5F5F5',
                    }}
                  >
                    <Text style={{ fontSize: 14, color: pendingFilters.sort === opt.value ? '#1677FF' : '#333' }}>{opt.label}</Text>
                    {pendingFilters.sort === opt.value && <Check size={16} color="#1677FF" />}
                  </Pressable>
                ))}
              </View>
            </FilterSection>

            {/* 仅显示有安装包 */}
            <FilterSection title="其他">
              <Pressable
                onPress={() => setPendingFilters((f) => ({ ...f, hasAssets: !f.hasAssets }))}
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10,
                  backgroundColor: '#F5F5F5',
                }}
              >
                <Text style={{ fontSize: 14, color: '#333' }}>仅显示有安装包的应用</Text>
                <View style={{
                  width: 22, height: 22, borderRadius: 6,
                  backgroundColor: pendingFilters.hasAssets ? '#1677FF' : '#E0E0E0',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  {pendingFilters.hasAssets && <Check size={14} color="#fff" />}
                </View>
              </Pressable>
            </FilterSection>
          </ScrollView>

          {/* 确认按钮 */}
          <View style={{ paddingHorizontal: 20, paddingTop: 16, gap: 10 }}>
            <Pressable
              onPress={applyFilter}
              style={{ backgroundColor: '#1677FF', borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>应用筛选</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── 筛选分组标题组件 ─────────────────────────────────────────────────────────
function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>{title}</Text>
      {children}
    </View>
  );
}


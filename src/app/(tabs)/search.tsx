import React, { useCallback, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, ScrollView, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { addSearchHistory, clearSearchHistory, getSearchHistory } from '@/lib/database';
import { addAppEvent, uploadPendingEventsToTrack } from '@/lib/events';
import { fetchSearchReposRaw, filterInstallable } from '@/lib/github';
import { supabase } from '@/client/supabase';
import type { AppItem } from '@/types';
import AppCard from '@/components/openappstore/AppCard';

const BLOCKED_PATTERNS = [
  /色情|裸体|黄片|成人片|约炮|嫖娼/i,
  /\b(porn|nude|xxx|sex(?:ual)?|av\b)/i,
  /赌博|赌场|博彩/i,
  /毒品|大麻|冰毒|海洛因|可卡因/i,
  /\b(drug|weed|cocaine)\b/i,
  /炸弹|枪支|暗网|杀人教程/i,
];
function isSafeKeyword(kw: string): boolean {
  return !BLOCKED_PATTERNS.some((re) => re.test(kw));
}

export default function SearchTab() {
  const inputRef = useRef<TextInput>(null);
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

  // 竞态防护：每次新搜索生成新 id，过期请求的结果直接丢弃
  const searchIdRef = useRef(0);
  const loadingRef = useRef(false);
  const lastKeywordRef = useRef('');

  const loadHistory = useCallback(async () => {
    try { setHistory(await getSearchHistory()); } catch { /* ignore */ }
  }, []);

  const loadHotWords = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_hot_keywords', { limit_n: 20 });
      if (!error && Array.isArray(data) && data.length > 0) {
        const words = (data as { keyword: string; cnt: number }[])
          .map((r) => r.keyword).filter(isSafeKeyword);
        if (words.length > 0) { setHotWords(words); return; }
      }
    } catch { /* 网络失败降级 */ }
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

  /**
   * 动态流式搜索：分批过滤，每批有安装包的项目立即追加显示
   * 严格禁止展示无安装包项目（无任何兜底）
   */
  const performSearch = async (kw: string, pageNum = 1, isLoadMore = false) => {
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

    inputRef.current?.blur();

    // 竞态防护：每次新搜索生成新 id
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

    try {
      // 拉取原始数据
      const raw = await fetchSearchReposRaw(k, {
        sort: 'stars', order: 'desc', page: pageNum, per_page: 50,
      });
      if (searchIdRef.current !== thisSearchId) return;

      setTotalCount(raw.total_count);
      setHasMore(raw.total_count > pageNum * 50);
      setPage(pageNum);

      if (raw.items.length === 0) {
        if (!isLoadMore) setLoading(false);
        else setLoadingMore(false);
        loadingRef.current = false;
        loadHotWords();
        return;
      }

      // 分批动态过滤：每批 10 个，过滤完立即追加有安装包的项目
      const BATCH = 10;
      const existingIds = new Set<number>();

      // 收集已有 id（加载更多时避免重复）
      if (isLoadMore) {
        // 通过 ref 或直接读取 state（闭包里 results 已过期，用追加时去重处理）
      }

      let firstBatch = true;
      for (let i = 0; i < raw.items.length; i += BATCH) {
        if (searchIdRef.current !== thisSearchId) return;
        const batch = raw.items.slice(i, i + BATCH);
        // 每批独立过滤（严格：只保留 ok:true）
        const filtered = await filterInstallable(batch, 8000);
        if (searchIdRef.current !== thisSearchId) return;

        if (filtered.length > 0) {
          setResults((prev) => {
            const ids = new Set(prev.map((a) => a.id));
            const newItems = filtered.filter((a) => !ids.has(a.id));
            return newItems.length > 0 ? [...prev, ...newItems] : prev;
          });
        }

        // 第一批结束后隐藏主 loading（后续批次追加不影响已有展示）
        if (firstBatch) {
          firstBatch = false;
          setLoading(false);
        }
      }

      loadHotWords();
    } catch (e: any) {
      if (searchIdRef.current !== thisSearchId) return;
      if (results.length === 0) {
        setError('搜索暂不可用：' + (e?.message || '网络错误'));
      }
    } finally {
      if (searchIdRef.current === thisSearchId) {
        setLoading(false);
        setLoadingMore(false);
        loadingRef.current = false;
      }
    }
  };

  const handleLoadMore = () => {
    if (loadingRef.current || !hasMore || loadingMore) return;
    loadingRef.current = true;
    performSearch(lastKeywordRef.current, page + 1, true);
  };

  const clearInput = () => { setInputValue(''); };
  const handleCancel = () => {
    clearInput();
    setSearched(false);
    setResults([]);
    setError('');
    setPage(1);
    setHasMore(false);
    setTotalCount(0);
    lastKeywordRef.current = '';
    searchIdRef.current++; // 作废所有进行中的请求回调
  };

  const tagStyle = {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 18,
    borderWidth: 1, borderColor: '#E8E8E8', backgroundColor: '#fff',
  } as const;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F5F5' }} edges={['top']}>
      {/* 搜索栏 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 10, gap: 8 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
          borderRadius: 10, paddingHorizontal: 10, height: 40, gap: 6 }}>
          <Ionicons name="search-outline" size={16} color="#AAA" />
          <TextInput
            ref={inputRef}
            style={{ flex: 1, fontSize: 15, color: '#1A1A1A' } as any}
            placeholder="搜索全部 GitHub 开源项目…"
            placeholderTextColor="#AAA"
            value={inputValue}
            onChangeText={setInputValue}
            onSubmitEditing={(e) => performSearch(e.nativeEvent.text || inputValue)}
            returnKeyType="search"
            underlineColorAndroid="transparent"
          />
          {inputValue.length > 0 && (
            <Pressable onPress={clearInput} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color="#AAA" />
            </Pressable>
          )}
        </View>
        {searched && (
          <Pressable onPress={handleCancel} hitSlop={8}>
            <Text style={{ color: '#1677FF', fontSize: 15 }}>取消</Text>
          </Pressable>
        )}
      </View>

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
              <Ionicons name="flame" size={14} color="#FF4D00" />
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
        <View style={{ margin: 16, padding: 16, borderRadius: 12, backgroundColor: '#FFF2F0',
          borderWidth: 1, borderColor: '#FFCCC7' }}>
          <Text style={{ color: '#d32f2f', fontSize: 14 }}>{error}</Text>
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
            <View style={{ paddingHorizontal: 16, paddingVertical: 8, gap: 4 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 13, color: '#888' }}>
                  GitHub 共匹配 {totalCount > 0 ? totalCount.toLocaleString() : results.length} 个项目，已过滤无安装包
                </Text>
              </View>
            </View>
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 60, gap: 8 }}>
              <Ionicons name="search-outline" size={48} color="#CCC" />
              <Text style={{ color: '#888', fontSize: 15, fontWeight: '600' }}>未找到相关应用</Text>
              <Text style={{ color: '#BBB', fontSize: 13 }}>试试其他关键词</Text>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: 16 }}>
                <ActivityIndicator color="#1677FF" />
              </View>
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
    </SafeAreaView>
  );
}

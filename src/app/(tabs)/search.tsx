import React, { useCallback, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, ScrollView, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { addSearchHistory, clearSearchHistory, getSearchHistory } from '@/lib/database';
import { addAppEvent, uploadPendingEventsToTrack } from '@/lib/events';
import { searchRepos } from '@/lib/github';
import { getHotWords } from '@/client/store';
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
  const [searchSource, setSearchSource] = useState<'init' | 'local' | 'remote' | 'hybrid'>('init');
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingRef = useRef(false);
  const lastKeywordRef = useRef('');
  const autoRetryRef = useRef(0);   // 连续空页自动翻页计数，防无限循环
  const MAX_AUTO_RETRY = 5;         // 最多连续跳过 5 个空页

  const loadHistory = useCallback(async () => {
    try { setHistory(await getSearchHistory()); } catch { /* ignore */ }
  }, []);

  const loadHotWords = useCallback(async () => {
    try {
      // 统一入口：store.getHotWords → supabase.rpc('get_hot_keywords', {limit_n})
      // 5 分钟客户端缓存，避免频繁调用
      const words = await getHotWords(20);
      const safe = words.filter(isSafeKeyword);
      if (safe.length > 0) { setHotWords(safe); return; }
    } catch { /* 静默失败，展示默认空状态 */ }

    // 兜底：读本地 events 里的高频搜索词
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

  /** 核心搜索：直接调用 GitHub 远程搜索（installableOnly=true） */
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

    if (!isLoadMore) {
      try { addSearchHistory(k).then(loadHistory); } catch { /* ignore */ }
      addAppEvent({ event_type: 'search', keyword: k }).catch(() => {})
      // 异步上传本地事件到 Supabase（不阻塞 UI）
      uploadPendingEventsToTrack().catch(() => {})

      lastKeywordRef.current = k;
      autoRetryRef.current = 0;
      setSearched(true);
      setLoading(true);
      setError('');
      setResults([]);
      setPage(1);
      setHasMore(false);
      setTotalCount(0);
      setSearchSource('init');
    } else {
      setLoadingMore(true);
    }

    // 远程搜索（installableOnly=true，per_page=50 与 Edge Function 批量上限对齐）
    try {
      const result = await searchRepos(k, {
        sort: 'stars',
        order: 'desc',
        page: pageNum,
        per_page: 50,
        installableOnly: true,
      });

      const morePages = result.total_count > pageNum * 100;

      if (!isLoadMore) {
        autoRetryRef.current = 0;
        setResults(result.items);
        setSearchSource(result.items.length > 0 ? 'remote' : 'local');
        setTotalCount(result.total_count);
        setHasMore(morePages);
        setError('');
        loadHotWords();
      } else {
        if (result.items.length === 0 && morePages && autoRetryRef.current < MAX_AUTO_RETRY) {
          // 当页全被过滤掉→静默翻到下一页，不闪烁 spinner
          autoRetryRef.current += 1;
          setLoadingMore(false);
          loadingRef.current = false;
          setPage(pageNum);
          // 直接继续下一页，不走 finally
          performSearch(k, pageNum + 1, true);
          return;
        }
        autoRetryRef.current = 0;
        setResults((prev) => [...prev, ...result.items]);
        setHasMore(morePages && result.items.length > 0);
      }
      setPage(pageNum);
    } catch (e: any) {
      if (!isLoadMore) {
        if (results.length === 0) {
          setError('远程搜索暂不可用：' + (e?.message || '网络错误，请检查后端服务'));
        }
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
      loadingRef.current = false;
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
    setSearchSource('init');
    lastKeywordRef.current = '';
  };
  const tagStyle = { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 18, borderWidth: 1, borderColor: '#E8E8E8', backgroundColor: '#fff' } as const;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F5F5' }} edges={['top']}>
      {/* 搜索栏：无搜索按钮，键盘 returnKey 触发 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 10, gap: 8 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 10, height: 40, gap: 6 }}>
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
      ) : (loading || loadingMore) && results.length === 0 ? (
        // 首次加载或自动翻页重试期间，结果还为空时显示 loading，防止提前显示"未找到"
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <ActivityIndicator color="#1677FF" size="large" />
          <Text style={{ fontSize: 13, color: '#AAA' }}>正在过滤无发行版项目…</Text>
        </View>
      ) : error && results.length === 0 ? (
        <View style={{ margin: 16, padding: 16, borderRadius: 12, backgroundColor: '#FFF2F0', borderWidth: 1, borderColor: '#FFCCC7' }}>
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
                  GitHub 共匹配 {totalCount > 0 ? totalCount.toLocaleString() : results.length} 个项目，已过滤无发行版
                </Text>
                {searchSource === 'remote' && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="cloud-done-outline" size={12} color="#52C41A" />
                    <Text style={{ fontSize: 11, color: '#52C41A' }}>GitHub</Text>
                  </View>
                )}
              </View>
            </View>
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 60, gap: 8 }}>
              <Ionicons name="search-outline" size={48} color="#CCC" />
              <Text style={{ color: '#888', fontSize: 15, fontWeight: '600' }}>
                未找到相关应用
              </Text>
              <Text style={{ color: '#BBB', fontSize: 13 }}>
                仅展示有安装包的 GitHub 开源项目，试试其他关键词
              </Text>
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

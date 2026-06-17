import React, { useCallback, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, ScrollView, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/client/supabase';
import { addSearchHistory, clearSearchHistory, getSearchHistory } from '@/lib/database';
import { addAppEvent } from '@/lib/events';
import type { AppItem } from '@/types';
import AppCard from '@/components/openappstore/AppCard';

// 前端兜底过滤词列表（防止数据库未覆盖的边缘词）
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
  // 受控输入：value 绑定 state，彻底消除 ref 时序问题
  const [inputValue, setInputValue] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [hotWords, setHotWords] = useState<string[]>([]);
  const [results, setResults] = useState<AppItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');

  const loadHistory = useCallback(async () => {
    try { setHistory(await getSearchHistory()); } catch { /* ignore */ }
  }, []);

  const loadHotWords = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('safe_hot_words')
        .select('keyword')
        .order('search_count', { ascending: false })
        .limit(20);
      if (Array.isArray(data) && data.length > 0) {
        setHotWords(data.map((r: any) => r.keyword).filter(isSafeKeyword));
        return;
      }
      // 视图暂无数据时，直接从 app_events 聚合并过滤
      const { data: events } = await supabase
        .from('app_events')
        .select('keyword')
        .eq('event_type', 'search')
        .not('keyword', 'is', null)
        .neq('keyword', '');
      if (Array.isArray(events) && events.length > 0) {
        const freq: Record<string, number> = {};
        for (const e of events) {
          if (e.keyword && isSafeKeyword(e.keyword)) {
            freq[e.keyword] = (freq[e.keyword] || 0) + 1;
          }
        }
        const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([k]) => k);
        setHotWords(sorted);
      }
    } catch { /* 静默失败 */ }
  }, []);

  useFocusEffect(useCallback(() => {
    loadHistory();
    loadHotWords();
  }, [loadHistory, loadHotWords]));

  const performSearch = async (kw: string) => {
    const k = kw.trim();
    if (!k) return;
    inputRef.current?.blur();
    try { addSearchHistory(k).then(loadHistory); } catch { /* ignore */ }
    addAppEvent({ event_type: 'search', keyword: k }).catch(() => {});

    // 先同步更新 UI 状态，确保 loading spinner 先显示
    setSearched(true);
    setLoading(true);
    setError('');
    setResults([]);

    try {
      // 全量拉取 app_catalog（仅有安装包的项目），然后 JS 端做关键词过滤。
      // 这样彻底绕开 PostgREST filter 的 URL 编码问题和 RPC schema cache 不可靠问题。
      const { data, error: dbError } = await supabase
        .from('app_catalog')
        .select('*')
        .eq('archived', false)
        .not('latest_version', 'is', null)   // 只要有安装包的项目
        .order('stars', { ascending: false })
        .limit(500);                          // 当前目录 <40 条，500 足够兜底

      if (dbError) {
        setError(dbError.message || `查询失败 (${dbError.code || 'unknown'})`);
        return;
      }

      // JS 端关键词匹配：name / repo / full_name / description / owner
      const lower = k.toLowerCase();
      const matched = (data || []).filter((r: any) =>
        r.name?.toLowerCase().includes(lower) ||
        r.repo?.toLowerCase().includes(lower) ||
        r.full_name?.toLowerCase().includes(lower) ||
        r.description?.toLowerCase().includes(lower) ||
        r.owner?.toLowerCase().includes(lower)
      );

      const items: AppItem[] = matched.map((r: any): AppItem => ({
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
      setResults(items);
    } catch (e: any) {
      setError(e?.message || e?.toString() || '搜索失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const clearInput = () => { setInputValue(''); };
  const handleCancel = () => { clearInput(); setSearched(false); setResults([]); setError(''); };
  const tagStyle = { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 18, borderWidth: 1, borderColor: '#E8E8E8', backgroundColor: '#fff' } as const;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F5F5' }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 10, gap: 8 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 10, height: 40, gap: 6 }}>
          <Ionicons name="search-outline" size={16} color="#AAA" />
          <TextInput
            ref={inputRef}
            style={{ flex: 1, fontSize: 15, color: '#1A1A1A' } as any}
            placeholder="搜索开源应用…"
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
        {/* 搜索按钮：确保任何情况都能触发搜索，不依赖键盘提交 */}
        <Pressable
          onPress={() => performSearch(inputValue)}
          style={{ backgroundColor: '#1677FF', borderRadius: 10, height: 40, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>搜索</Text>
        </Pressable>
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
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#1677FF" size="large" />
        </View>
      ) : error ? (
        <View style={{ margin: 16, padding: 16, borderRadius: 12, backgroundColor: '#FFF2F0', borderWidth: 1, borderColor: '#FFCCC7' }}>
          <Text style={{ color: '#d32f2f', fontSize: 14 }}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => String(item.id)}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => <AppCard app={item} />}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListEmptyComponent={<View style={{ alignItems: 'center', paddingTop: 60 }}><Text style={{ color: '#AAA' }}>未找到相关应用</Text></View>}
        />
      )}
    </SafeAreaView>
  );
}

import React, { useCallback, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, ScrollView, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { searchRepos, enrichAppsInBackground } from '@/lib/github';
import { addSearchHistory, clearSearchHistory, getSearchHistory } from '@/lib/database';
import { addAppEvent } from '@/lib/events';
import { supabase } from '@/client/supabase';
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
  const textRef = useRef('');
  const [hasText, setHasText] = useState(false);
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
    try {
      setLoading(true); setSearched(true); setError('');
      // 首屏直接展示搜索结果，不阻塞等待安装包校验
      const { items } = await searchRepos(`${k} stars:>10 archived:false`, { sort: 'stars', per_page: 30 });
      setResults(items);
      // 后台静默补充版本/下载量信息，只保留有安装包的应用
      enrichAppsInBackground(items, (enriched) => {
        setResults(enriched.filter((a) => a.has_installable_assets));
      });
    } catch (e: any) {
      // 保留已有结果，不清空列表；仅展示错误提示
      setError(e?.message || '搜索失败');
    } finally {
      setLoading(false);
    }
  };

  const clearInput = () => { inputRef.current?.clear(); textRef.current = ''; setHasText(false); };
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
            onChangeText={(t) => { textRef.current = t; setHasText(t.length > 0); }}
            onSubmitEditing={() => performSearch(textRef.current)}
            returnKeyType="search"
            underlineColorAndroid="transparent"
          />
          {hasText && (
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

import React, { useCallback, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, ScrollView, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { searchRepos } from '@/lib/github';
import { addSearchHistory, clearSearchHistory, getSearchHistory } from '@/lib/database';
import type { AppItem } from '@/types';
import AppCard from '@/components/openappstore/AppCard';

const HOT = ['VLC', 'Telegram', 'OBS', 'Signal', 'Termux', 'Bitwarden', 'Kodi', 'Neovim'];

export default function SearchTab() {
  const inputRef = useRef<TextInput>(null);
  const textRef = useRef('');
  const [hasText, setHasText] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [results, setResults] = useState<AppItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');

  const loadHistory = useCallback(async () => {
    try { setHistory(await getSearchHistory()); } catch { /* ignore */ }
  }, []);

  useFocusEffect(useCallback(() => { loadHistory(); }, [loadHistory]));

  const performSearch = async (kw: string) => {
    const k = kw.trim();
    if (!k) return;
    inputRef.current?.blur();
    try { addSearchHistory(k).then(loadHistory); } catch { /* ignore */ }
    try {
      setLoading(true); setSearched(true); setError('');
      const { items } = await searchRepos(`${k} stars:>10`, { sort: 'stars', per_page: 30 });
      setResults(items);
    } catch (e: any) {
      setError(e?.message || '搜索失败'); setResults([]);
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
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {HOT.map((h) => (
                <Pressable key={h} onPress={() => performSearch(h)} style={tagStyle}>
                  <Text style={{ fontSize: 13, color: '#333' }}>{h}</Text>
                </Pressable>
              ))}
            </View>
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

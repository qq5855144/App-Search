// 非受控模式：不传 value prop，用 textRef 持有实际文本，避免 Android 光标跳末尾 + 布局抖动
import { View, Text, TextInput, Pressable, FlatList, ScrollView, ActivityIndicator, useWindowDimensions } from 'react-native';
import { useCallback, useRef, useState } from 'react';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { Ionicons } from '@expo/vector-icons';
import { searchRepos } from '@/lib/github';
import { addSearchHistory, clearSearchHistory, getSearchHistory } from '@/lib/database';
import type { AppItem } from '@/types';
import AppCard from '@/components/openappstore/AppCard';
import EmptyState from '@/components/openappstore/EmptyState';

const HOT_SEARCHES = ['VLC', 'Telegram', 'OBS', 'Signal', 'Termux', 'Syncthing', 'Bitwarden', 'Kodi', 'Neovim', 'FFmpeg'];

function useResponsive() {
  const { width } = useWindowDimensions();
  const isWide = width >= 600;
  const contentWidth = isWide ? Math.min(width, 720) : width;
  const hPad = isWide ? 24 : 16;
  return { isWide, contentWidth, hPad };
}

export default function SearchTab() {
  const inputRef = useRef<TextInput>(null);
  // 非受控：textRef 持有实时文本，不触发 re-render，彻底解决 Android 光标跳末尾
  const textRef = useRef('');
  // 仅控制清除按钮显隐，不绑定到 TextInput value
  const [hasText, setHasText] = useState(false);

  const [history, setHistory] = useState<string[]>([]);
  const [results, setResults] = useState<AppItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const { isWide, contentWidth, hPad } = useResponsive();
  const { focus } = useLocalSearchParams<{ focus?: string }>();

  const loadHistory = useCallback(async () => {
    const h = await getSearchHistory();
    setHistory(h);
  }, []);

  useFocusEffect(useCallback(() => {
    loadHistory();
    if (focus === '1') {
      const timer = setTimeout(() => inputRef.current?.focus(), 320);
      return () => clearTimeout(timer);
    }
  }, [loadHistory, focus]));

  const handleChangeText = useCallback((text: string) => {
    textRef.current = text;
    setHasText(text.length > 0);
  }, []);

  /** 清除输入框：用 setNativeProps 避免销毁/重建 TextInput */
  const clearInput = useCallback(() => {
    inputRef.current?.clear();
    textRef.current = '';
    setHasText(false);
  }, []);

  const performSearch = async (keyword: string) => {
    const kw = keyword.trim();
    if (!kw) return;
    inputRef.current?.blur();
    // 写历史记录不阻塞搜索，OPFS 冲突等 DB 错误不应影响搜索功能
    addSearchHistory(kw).catch(() => null);
    setHistory((prev) => [kw, ...prev.filter((k) => k !== kw)].slice(0, 20));
    try {
      setLoading(true);
      setSearched(true);
      setSearchError(null);
      const { items } = await searchRepos(`${kw} stars:>10`, { sort: 'stars', per_page: 30 });
      setResults(items);
    } catch (e: any) {
      const msg: string = e?.message || '搜索失败，请稍后重试';
      if (msg.includes('403') || msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('secondary')) {
        setSearchError('API 请求超限（匿名每小时 10 次），请在「我的」页面配置 GitHub Token 以提高限额');
      } else if (msg.includes('422')) {
        setSearchError('搜索关键词格式有误，请换个词试试');
      } else if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('fetch')) {
        setSearchError('网络连接失败，请检查网络后重试');
      } else {
        setSearchError(`搜索失败：${msg}`);
      }
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  /** 点击历史/热门词：直接触发搜索，不依赖 setNativeProps（Web 不可靠） */
  const searchFromTag = (kw: string) => {
    textRef.current = kw;
    setHasText(true);
    // setNativeProps 在 Web 上不可靠，改为在 performSearch 后让 input 通过 defaultValue 刷新
    // 直接传 kw 给 performSearch，不依赖 input DOM 状态
    performSearch(kw);
  };

  const handleClearHistory = async () => {
    await clearSearchHistory();
    setHistory([]);
  };

  const handleCancel = () => {
    setSearched(false);
    clearInput();
    setResults([]);
    setSearchError(null);
    inputRef.current?.blur();
  };

  const tagStyle = {
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    backgroundColor: '#FFFFFF',
  };

  const centerWrap = isWide ? { alignItems: 'center' as const } : {};
  const innerWrap = isWide ? { width: contentWidth } : {};

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F5F5' }} edges={['top']}>
      {/* Android 已设 softwareKeyboardLayoutMode=pan，不需要 KAV，避免高度重算抖动 */}
      <View style={{ flex: 1 }}>
        {/* ── 搜索框：非受控模式，永不绑定 value，彻底消除光标跳末尾 ── */}
        <View style={centerWrap}>
          <View style={[innerWrap, {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: hPad,
            paddingTop: 8,
            paddingBottom: 8,
            gap: 10,
          }]}>
            <View style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#FFFFFF',
              borderRadius: 12,
              paddingHorizontal: 12,
              // 用固定高度代替 paddingVertical，防止 Web 聚焦时 outline/border 撑高搜索框
              height: 42,
              boxShadow: [{ offsetX: 0, offsetY: 1, blurRadius: 3, color: 'rgba(0,0,0,0.08)' }],
            } as any}>
              <Ionicons name="search-outline" size={16} color="#AAAAAA" />
              <TextInput
                ref={inputRef}
                style={{
                  flex: 1,
                  marginLeft: 7,
                  fontSize: 15,
                  // lineHeight 固定行高，防止平台差异导致高度抖动
                  lineHeight: 20,
                  color: '#1A1A1A',
                  // Web: 消除聚焦时的 outline 和 border（这两者会撑高搜索框）
                  outlineWidth: 0,
                  outlineStyle: 'none',
                  borderWidth: 0,
                } as any}
                placeholder="搜索开源应用…"
                placeholderTextColor="#AAAAAA"
                // 故意不传 value — 非受控，Android 不会重置光标
                onChangeText={handleChangeText}
                onSubmitEditing={() => performSearch(textRef.current)}
                returnKeyType="search"
                underlineColorAndroid="transparent"
                blurOnSubmit={false}
              />
              {hasText && (
                <Pressable onPress={clearInput} style={{ padding: 2 }} hitSlop={8}>
                  <X size={15} color="#AAAAAA" />
                </Pressable>
              )}
            </View>
            {searched && (
              <Pressable onPress={handleCancel} style={{ paddingVertical: 4 }} hitSlop={8}>
                <Text style={{ fontSize: 15, color: '#1677FF' }}>取消</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* ── 内容区 ── */}
        {!searched ? (
          // 预搜索区：用 ScrollView 替代 FlatList(data=[])
          // FlatList 内部手势识别会延迟 onPress（判断是否为滚动），ScrollView 无此问题
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              { paddingTop: 6, paddingBottom: 32 },
              isWide ? { alignItems: 'center' } : undefined,
            ]}
          >
            <View style={{ width: isWide ? contentWidth : undefined }}>
              {history.length > 0 && (
                <View style={{ paddingHorizontal: hPad, marginBottom: 20 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: '#1A1A1A' }}>搜索历史</Text>
                    <Pressable onPress={handleClearHistory} hitSlop={8}>
                      <Text style={{ fontSize: 13, color: '#999999' }}>清空</Text>
                    </Pressable>
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {history.map((item) => (
                      <Pressable key={item} onPress={() => searchFromTag(item)} style={tagStyle}>
                        <Text style={{ fontSize: 13, color: '#333333' }}>{item}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}
              <View style={{ paddingHorizontal: hPad }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 5 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#1A1A1A' }}>热门搜索</Text>
                  <Ionicons name="flame" size={16} color="#FF4D00" />
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {HOT_SEARCHES.map((item) => (
                    <Pressable key={item} onPress={() => searchFromTag(item)} style={tagStyle}>
                      <Text style={{ fontSize: 13, color: '#333333' }}>{item}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
          </ScrollView>
        ) : loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color="#1677FF" size="large" />
          </View>
        ) : searchError ? (
          <View style={centerWrap}>
            <View style={[innerWrap, {
              margin: hPad, padding: 16, borderRadius: 14,
              backgroundColor: '#FFF2F0', borderWidth: 1, borderColor: '#FFCCC7',
            }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Ionicons name="warning-outline" size={18} color="#FF4D4F" />
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#FF4D4F' }}>搜索失败</Text>
              </View>
              <Text style={{ fontSize: 13, color: '#7A0000', lineHeight: 20 }}>{searchError}</Text>
            </View>
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item) => item.id.toString()}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <View style={centerWrap}>
                <View style={innerWrap}>
                  <AppCard app={item} />
                </View>
              </View>
            )}
            ListEmptyComponent={<EmptyState title="未找到相关应用" />}
            contentContainerStyle={{ paddingBottom: 24, paddingTop: 6 }}
            contentInsetAdjustmentBehavior="automatic"
          />
        )}
      </View>
    </SafeAreaView>
  );
}

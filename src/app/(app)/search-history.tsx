import { View, Text, Pressable, FlatList } from 'react-native';
import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Clock, X } from 'lucide-react-native';
import { getSearchHistory, clearSearchHistory } from '@/lib/database';
import EmptyState from '@/components/openappstore/EmptyState';

export default function SearchHistoryScreen() {
  const router = useRouter();
  const [history, setHistory] = useState<string[]>([]);

  const load = useCallback(async () => {
    const h = await getSearchHistory();
    setHistory(h);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleClear = async () => {
    await clearSearchHistory();
    setHistory([]);
  };

  const handleSearch = (keyword: string) => {
    router.push({ pathname: '/(app)/(tabs)/search', params: { q: keyword } } as any);
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* 头部 */}
      <View className="flex-row items-center px-4 py-2">
        <Pressable onPress={() => router.back()} className="p-2">
          <ArrowLeft size={24} color="#1A1A1A" />
        </Pressable>
        <Text className="flex-1 text-center text-base font-semibold text-foreground pr-10">搜索历史</Text>
        {history.length > 0 && (
          <Pressable onPress={handleClear} className="p-2">
            <X size={20} color="#FF4D4F" />
          </Pressable>
        )}
      </View>

      {/* 历史列表 */}
      <FlatList
        data={history}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => handleSearch(item)}
            className="mx-4 px-4 py-3 rounded-xl bg-card mb-2 flex-row items-center"
            style={{ boxShadow: [{ offsetX: 0, offsetY: 1, blurRadius: 3, color: 'rgba(0,0,0,0.08)' }] }}
          >
            <Clock size={16} color="#999999" />
            <Text className="flex-1 text-sm text-foreground ml-3">{item}</Text>
          </Pressable>
        )}
        keyExtractor={(item, index) => `${item}_${index}`}
        ListEmptyComponent={<EmptyState title="暂无搜索历史" />}
        contentContainerClassName="pb-4"
      />
    </SafeAreaView>
  );
}

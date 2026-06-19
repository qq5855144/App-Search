import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getFavorites, removeFavorite } from '@/lib/database';
import { useAndroidGoBack } from '@/hooks/useAndroidGoBack';
import type { FavoriteItem } from '@/types';
import AppIcon from '@/components/openappstore/AppIcon';

export default function FavoritesScreen() {
  useAndroidGoBack();
  const router = useRouter();
  const [items, setItems] = useState<FavoriteItem[]>([]);

  const load = useCallback(async () => {
    try { setItems(await getFavorites()); } catch { /* ignore */ }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F6F8' }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#E8E8E8' }}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)' as any)} hitSlop={12} style={{ marginRight: 12 }}>
          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
        </Pressable>
        <Text style={{ flex: 1, fontSize: 18, fontWeight: '700' }}>我的收藏</Text>
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 12, gap: 8, paddingBottom: 24 }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/detail/[id]', params: { id: String(item.app_id), owner: item.owner, repo: item.repo } } as any)}
            style={{ backgroundColor: '#fff', borderRadius: 14, padding: 14, flexDirection: 'row', gap: 12, alignItems: 'center' }}
          >
            <AppIcon owner={item.owner} url={item.avatar_url} name={item.app_name} size={44} />
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ fontWeight: '600', color: '#1A1A1A' }}>{item.app_name}</Text>
              <Text style={{ fontSize: 12, color: '#888' }} numberOfLines={1}>{item.description || item.owner}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="star" size={11} color="#FFB300" />
                <Text style={{ fontSize: 12, color: '#888' }}>{item.stars >= 1000 ? `${(item.stars/1000).toFixed(1)}k` : item.stars}</Text>
              </View>
            </View>
            <Pressable onPress={() => removeFavorite(item.app_id).then(load)} hitSlop={10}>
              <Ionicons name="heart" size={20} color="#FF4D88" />
            </Pressable>
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: 80, gap: 8 }}>
            <Ionicons name="heart-outline" size={48} color="#CCC" />
            <Text style={{ color: '#AAA' }}>暂无收藏</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

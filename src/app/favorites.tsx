import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAndroidGoBack } from '@/hooks/useAndroidGoBack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getFavorites, removeFavorite, addFavorite, isFavorite } from '@/lib/database';
import { getToken } from '@/lib/token';
import { fetchUserStarred } from '@/lib/github';
import type { FavoriteItem } from '@/types';
import AppIcon from '@/components/openappstore/AppIcon';

type SyncState = 'idle' | 'syncing' | 'done' | 'error';

export default function FavoritesScreen() {
  useAndroidGoBack();

  const router = useRouter();
  const [items, setItems] = useState<FavoriteItem[]>([]);
  const [hasToken, setHasToken] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [syncMsg, setSyncMsg] = useState('');

  const load = useCallback(async () => {
    try {
      const [favs, token] = await Promise.all([getFavorites(), getToken()]);
      setItems(favs);
      setHasToken(!!token);
    } catch { /* ignore */ }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleSync = async () => {
    if (syncState === 'syncing') return;
    setSyncState('syncing');
    setSyncMsg('');
    try {
      const starred = await fetchUserStarred();
      let added = 0;
      for (const app of starred) {
        const already = await isFavorite(app.id);
        if (!already) {
          await addFavorite(app);
          added++;
        }
      }
      setSyncMsg(`同步完成，新增 ${added} 个`);
      setSyncState('done');
      await load();
      // 3s 后回到 idle
      setTimeout(() => setSyncState('idle'), 3000);
    } catch (e: any) {
      setSyncMsg(e?.message ?? '同步失败');
      setSyncState('error');
      setTimeout(() => setSyncState('idle'), 4000);
    }
  };

  // ── 同步按钮状态渲染 ──────────────────────────────────
  const renderSyncBtn = () => {
    if (!hasToken) return null;
    if (syncState === 'syncing') {
      return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 4 }}>
          <ActivityIndicator size={16} color="#1677FF" />
          <Text style={{ fontSize: 13, color: '#1677FF' }}>同步中</Text>
        </View>
      );
    }
    return (
      <Pressable
        onPress={handleSync}
        hitSlop={10}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 4,
          backgroundColor: '#E8F4FF', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}
      >
        <Ionicons
          name={syncState === 'done' ? 'checkmark-circle' : syncState === 'error' ? 'alert-circle' : 'sync-outline'}
          size={15}
          color={syncState === 'done' ? '#52C41A' : syncState === 'error' ? '#FF4D4F' : '#1677FF'}
        />
        <Text style={{
          fontSize: 13, fontWeight: '500',
          color: syncState === 'done' ? '#52C41A' : syncState === 'error' ? '#FF4D4F' : '#1677FF',
        }}>
          {syncState === 'done' ? '已同步' : syncState === 'error' ? '失败' : '同步 Stars'}
        </Text>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F6F8' }} edges={['top']}>
      {/* ── 导航栏 ── */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
        paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#E8E8E8' }}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)' as any)}
          hitSlop={12} style={{ marginRight: 12 }}>
          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
        </Pressable>
        <Text style={{ flex: 1, fontSize: 18, fontWeight: '700' }}>
          我的收藏{items.length > 0 ? ` (${items.length})` : ''}
        </Text>
        {renderSyncBtn()}
      </View>

      {/* ── 同步结果提示条 ── */}
      {syncMsg !== '' && (syncState === 'done' || syncState === 'error') && (
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 6,
          backgroundColor: syncState === 'done' ? '#F6FFED' : '#FFF2F0',
          paddingHorizontal: 16, paddingVertical: 8,
          borderBottomWidth: 0.5,
          borderBottomColor: syncState === 'done' ? '#B7EB8F' : '#FFCCC7',
        }}>
          <Ionicons
            name={syncState === 'done' ? 'checkmark-circle-outline' : 'alert-circle-outline'}
            size={15}
            color={syncState === 'done' ? '#52C41A' : '#FF4D4F'}
          />
          <Text style={{ fontSize: 13, color: syncState === 'done' ? '#389E0D' : '#CF1322' }}>
            {syncMsg}
          </Text>
        </View>
      )}

      {/* ── 无 Token 提示 ── */}
      {!hasToken && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8,
          backgroundColor: '#FFFBE6', paddingHorizontal: 16, paddingVertical: 10,
          borderBottomWidth: 0.5, borderBottomColor: '#FFE58F' }}>
          <Ionicons name="information-circle-outline" size={16} color="#FA8C16" />
          <Text style={{ flex: 1, fontSize: 12, color: '#AD6800', lineHeight: 18 }}>
            在「我的」页面配置 GitHub Token 后可同步 Star 的项目
          </Text>
          <Pressable onPress={() => router.replace('/(tabs)/profile' as any)} hitSlop={8}>
            <Text style={{ fontSize: 12, color: '#FA8C16', fontWeight: '600' }}>去配置</Text>
          </Pressable>
        </View>
      )}

      {/* ── 列表 ── */}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 12, gap: 8, paddingBottom: 24 }}
        contentInsetAdjustmentBehavior="automatic"
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/detail/[id]',
              params: { id: String(item.app_id), owner: item.owner, repo: item.repo } } as any)}
            style={{ backgroundColor: '#fff', borderRadius: 14, padding: 14,
              flexDirection: 'row', gap: 12, alignItems: 'center' }}
          >
            <AppIcon owner={item.owner} url={item.avatar_url} name={item.app_name} size={44} />
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ fontWeight: '600', color: '#1A1A1A' }}>{item.app_name}</Text>
              <Text style={{ fontSize: 12, color: '#888' }} numberOfLines={1}>
                {item.description || item.owner}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="star" size={11} color="#FFB300" />
                <Text style={{ fontSize: 12, color: '#888' }}>
                  {item.stars >= 1000 ? `${(item.stars / 1000).toFixed(1)}k` : item.stars}
                </Text>
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
            {hasToken && (
              <Pressable onPress={handleSync} disabled={syncState === 'syncing'}
                style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 6,
                  backgroundColor: '#E8F4FF', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 }}>
                <Ionicons name="sync-outline" size={16} color="#1677FF" />
                <Text style={{ color: '#1677FF', fontSize: 14, fontWeight: '600' }}>同步 GitHub Stars</Text>
              </Pressable>
            )}
          </View>
        }
      />
    </SafeAreaView>
  );
}

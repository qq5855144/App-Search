import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, Linking } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getDownloadHistory, clearDownloadHistory } from '@/lib/database';
import type { DownloadRecord } from '@/types';
import AppIcon from '@/components/openappstore/AppIcon';

export default function DownloadsScreen() {
  const router = useRouter();
  const [records, setRecords] = useState<DownloadRecord[]>([]);

  const load = useCallback(async () => {
    try { setRecords(await getDownloadHistory()); } catch { /* ignore */ }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F6F8' }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#E8E8E8' }}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={{ marginRight: 12 }}>
          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
        </Pressable>
        <Text style={{ flex: 1, fontSize: 18, fontWeight: '700' }}>下载记录</Text>
        {records.length > 0 && (
          <Pressable onPress={async () => { await clearDownloadHistory(); setRecords([]); }} hitSlop={8}>
            <Text style={{ color: '#f5222d', fontSize: 14 }}>清空</Text>
          </Pressable>
        )}
      </View>
      <FlatList
        data={records}
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
              <Text style={{ fontSize: 12, color: '#888' }}>{item.version} · {item.download_time?.slice(0, 10)}</Text>
            </View>
            {item.html_url && (
              <Pressable onPress={() => Linking.openURL(item.html_url)} hitSlop={8}>
                <Ionicons name="open-outline" size={20} color="#1677FF" />
              </Pressable>
            )}
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: 80, gap: 8 }}>
            <Ionicons name="download-outline" size={48} color="#CCC" />
            <Text style={{ color: '#AAA' }}>暂无下载记录</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

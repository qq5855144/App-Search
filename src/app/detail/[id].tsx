import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, Linking } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { fetchRepoDetail, fetchReleases } from '@/lib/github';
import { addFavorite, removeFavorite, isFavorite } from '@/lib/database';
import type { AppItem, GitHubRelease } from '@/types';

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function DetailScreen() {
  const { owner, repo } = useLocalSearchParams<{ owner: string; repo: string }>();
  const router = useRouter();
  const [app, setApp] = useState<AppItem | null>(null);
  const [releases, setReleases] = useState<GitHubRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [favored, setFavored] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!owner || !repo) return;
    (async () => {
      try {
        setLoading(true);
        const [detail, rels, fav] = await Promise.all([
          fetchRepoDetail(owner, repo),
          fetchReleases(owner, repo).catch(() => [] as GitHubRelease[]),
          isFavorite(0).catch(() => false),
        ]);
        setApp(detail);
        setReleases(rels.slice(0, 3));
        const f = await isFavorite(detail.id);
        setFavored(f);
      } catch (e: any) {
        setError(e?.message || '加载失败');
      } finally {
        setLoading(false);
      }
    })();
  }, [owner, repo]);

  const toggleFav = async () => {
    if (!app) return;
    if (favored) {
      await removeFavorite(app.id);
      setFavored(false);
    } else {
      await addFavorite(app);
      setFavored(true);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F6F8', alignItems: 'center', justifyContent: 'center' }} edges={['top']}>
        <ActivityIndicator color="#1677FF" size="large" />
      </SafeAreaView>
    );
  }

  if (error || !app) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F6F8', alignItems: 'center', justifyContent: 'center', padding: 24 }} edges={['top']}>
        <Text style={{ color: '#d32f2f', fontSize: 16, textAlign: 'center', marginBottom: 20 }}>{error || '加载失败'}</Text>
        <Pressable onPress={() => router.back()} style={{ backgroundColor: '#1677FF', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 }}>
          <Text style={{ color: '#fff', fontWeight: '600' }}>返回</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F6F8' }} edges={['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#E8E8E8' }}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={{ marginRight: 12 }}>
          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
        </Pressable>
        <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: '#1A1A1A' }} numberOfLines={1}>{app.name}</Text>
        <Pressable onPress={toggleFav} hitSlop={12}>
          <Ionicons name={favored ? 'heart' : 'heart-outline'} size={24} color={favored ? '#FF4D88' : '#555'} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
        {/* App Info */}
        <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <Image source={{ uri: app.avatar_url }} style={{ width: 64, height: 64, borderRadius: 14 }} contentFit="cover" />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#1A1A1A' }}>{app.name}</Text>
            <Text style={{ fontSize: 13, color: '#888' }}>{app.owner}</Text>
            {app.description && <Text style={{ fontSize: 13, color: '#555', lineHeight: 18 }} numberOfLines={2}>{app.description}</Text>}
          </View>
        </View>

        {/* Stats */}
        <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, flexDirection: 'row', justifyContent: 'space-around' }}>
          {[
            { icon: 'star-outline' as const,       color: '#FFB300', label: '⭐ Stars',  value: app.stars >= 1000 ? `${(app.stars/1000).toFixed(1)}k` : String(app.stars) },
            { icon: 'git-branch-outline' as const,  color: '#1677FF', label: 'Forks',     value: String(app.forks) },
            { icon: 'code-outline' as const,         color: '#722ED1', label: '语言',      value: app.language || '-' },
          ].map((s) => (
            <View key={s.label} style={{ alignItems: 'center', gap: 4 }}>
              <Ionicons name={s.icon} size={22} color={s.color} />
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#1A1A1A' }}>{s.value}</Text>
              <Text style={{ fontSize: 12, color: '#888' }}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Open in GitHub */}
        <Pressable
          onPress={() => Linking.openURL(app.html_url)}
          style={{ backgroundColor: '#1A1A1A', borderRadius: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          <Ionicons name="logo-github" size={20} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>在 GitHub 查看</Text>
        </Pressable>

        {/* Releases */}
        {releases.length > 0 && (
          <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 12 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#1A1A1A' }}>最新版本</Text>
            {releases.map((rel) => (
              <View key={rel.id} style={{ borderTopWidth: 0.5, borderTopColor: '#F0F0F0', paddingTop: 12, gap: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontWeight: '600', color: '#1A1A1A' }}>{rel.tag_name}</Text>
                  <Text style={{ fontSize: 12, color: '#AAA' }}>{rel.published_at?.slice(0, 10)}</Text>
                </View>
                {rel.assets.slice(0, 3).map((asset) => (
                  <Pressable
                    key={asset.name}
                    onPress={() => Linking.openURL(asset.browser_download_url)}
                    style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F7F9FF', borderRadius: 10, padding: 10, gap: 8 }}
                  >
                    <Ionicons name="download-outline" size={16} color="#1677FF" />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, color: '#1A1A1A' }} numberOfLines={1}>{asset.name}</Text>
                      <Text style={{ fontSize: 11, color: '#AAA' }}>{formatBytes(asset.size)}</Text>
                    </View>
                    <Ionicons name="open-outline" size={14} color="#AAA" />
                  </Pressable>
                ))}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

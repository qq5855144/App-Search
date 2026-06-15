import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, Linking, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { fetchRepoDetail, fetchReleases, fetchReadme, getPlatformFromFilename, filterInstallAssets } from '@/lib/github';
import { addFavorite, removeFavorite, isFavorite } from '@/lib/database';
import type { AppItem, GitHubRelease } from '@/types';
import PlatformTag from '@/components/openappstore/PlatformTag';
import Marked from 'react-native-marked';

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatCount(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

/** 安全渲染 Markdown，兼容 Web/Native */
function MarkdownSection({ content }: { content: string }) {
  if (!content) return null;
  // Web 平台：直接用 HTML 渲染，避免 react-native-marked 在 web 上的渲染异常
  if (Platform.OS === 'web') {
    // 简单的 Markdown → HTML 转换（段落、标题、代码块、链接）
    const html = content
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/^### (.+)$/gm, '<h3 style="font-size:14px;font-weight:700;margin:12px 0 4px;color:#1A1A1A">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 style="font-size:16px;font-weight:700;margin:14px 0 6px;color:#1A1A1A">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 style="font-size:18px;font-weight:700;margin:16px 0 8px;color:#1A1A1A">$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code style="background:#F0F0F0;border-radius:3px;padding:1px 4px;font-family:monospace;font-size:12px">$1</code>')
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" style="color:#1677FF">$1</a>')
      .replace(/\n\n/g, '</p><p style="margin:0 0 8px;color:#555;font-size:14px;line-height:22px">')
      .replace(/\n/g, '<br/>');
    return (
      <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, marginTop: 4 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: '#1A1A1A', marginBottom: 10 }}>README</Text>
        <View>
          {/* @ts-ignore — web only div */}
          <div
            style={{ fontSize: 14, lineHeight: '22px', color: '#555', fontFamily: 'system-ui, sans-serif' }}
            dangerouslySetInnerHTML={{ __html: `<p style="margin:0 0 8px;color:#555;font-size:14px;line-height:22px">${html}</p>` }}
          />
        </View>
      </View>
    );
  }
  // Native 平台：使用 react-native-marked
  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, marginTop: 4 }}>
      <Text style={{ fontSize: 15, fontWeight: '700', color: '#1A1A1A', marginBottom: 10 }}>README</Text>
      <Marked
        value={content}
        flatListProps={{ scrollEnabled: false }}
        styles={{
          text: { fontSize: 14, color: '#555', lineHeight: 22 },
          h1: { fontSize: 18, fontWeight: '700', color: '#1A1A1A', marginBottom: 8, marginTop: 16 },
          h2: { fontSize: 16, fontWeight: '700', color: '#1A1A1A', marginBottom: 6, marginTop: 14 },
          h3: { fontSize: 14, fontWeight: '700', color: '#1A1A1A', marginBottom: 4, marginTop: 12 },
          code: { backgroundColor: '#F0F0F0', borderRadius: 4 },
          blockquote: { borderLeftWidth: 3, borderLeftColor: '#DDD', paddingLeft: 12, marginLeft: 0 },
          link: { color: '#1677FF' },
        }}
      />
    </View>
  );
}

export default function DetailScreen() {
  const { owner, repo } = useLocalSearchParams<{ owner: string; repo: string }>();
  const router = useRouter();
  const [app, setApp] = useState<AppItem | null>(null);
  const [releases, setReleases] = useState<GitHubRelease[]>([]);
  const [readme, setReadme] = useState('');
  const [loading, setLoading] = useState(true);
  const [favored, setFavored] = useState(false);
  const [error, setError] = useState('');
  const [expandedRelease, setExpandedRelease] = useState<number | null>(null);

  useEffect(() => {
    if (!owner || !repo) return;
    (async () => {
      try {
        setLoading(true);
        const [detail, rels, md] = await Promise.all([
          fetchRepoDetail(owner, repo),
          fetchReleases(owner, repo).catch(() => [] as GitHubRelease[]),
          fetchReadme(owner, repo).catch(() => ''),
        ]);
        setApp(detail);
        const installRels = rels.map((r) => ({
          ...r,
          assets: filterInstallAssets(r.assets),
        })).filter((r) => r.assets.length > 0);
        setReleases(installRels);
        if (installRels.length > 0) setExpandedRelease(installRels[0].id);
        setReadme(md.slice(0, 4000)); // 限制长度避免渲染卡顿
        const f = await isFavorite(detail.id).catch(() => false);
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
    if (favored) { await removeFavorite(app.id); setFavored(false); }
    else { await addFavorite(app); setFavored(true); }
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
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
        backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#EBEBEB' }}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={{ marginRight: 12 }}>
          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
        </Pressable>
        <Text style={{ flex: 1, fontSize: 17, fontWeight: '600', color: '#1A1A1A' }} numberOfLines={1}>{app.name}</Text>
        <Pressable onPress={toggleFav} hitSlop={12}>
          <Ionicons name={favored ? 'heart' : 'heart-outline'} size={24} color={favored ? '#FF4D88' : '#888'} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 12, gap: 10, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        {/* 应用头部信息卡片 */}
        <View style={{ backgroundColor: '#fff', borderRadius: 18, padding: 16, gap: 12,
          boxShadow: [{ offsetX: 0, offsetY: 1, blurRadius: 4, color: 'rgba(0,0,0,0.06)' }] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Image source={{ uri: app.avatar_url }}
              style={{ width: 80, height: 80, borderRadius: 18, borderWidth: 1, borderColor: '#F0F0F0' }}
              contentFit="cover" />
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: '#1A1A1A' }}>{app.name}</Text>
              {/* 平台标签 */}
              {app.platforms.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {app.platforms.map((p) => <PlatformTag key={p} platform={p} />)}
                </View>
              )}
            </View>
          </View>

          {/* 统计三格 */}
          <View style={{ flexDirection: 'row', backgroundColor: '#F7F9FC', borderRadius: 14, overflow: 'hidden' }}>
            {[
              { icon: 'star' as const, iconColor: '#FFB300', value: formatCount(app.stars), label: 'Stars' },
              { icon: 'git-branch-outline' as const, iconColor: '#00B96B', value: formatCount(app.forks), label: 'Forks' },
              { icon: 'code-slash-outline' as const, iconColor: '#1677FF', value: app.language || '-', label: '语言' },
            ].map((s, i) => (
              <View key={s.label} style={{ flex: 1, alignItems: 'center', paddingVertical: 14, gap: 4,
                borderRightWidth: i < 2 ? 1 : 0, borderRightColor: '#EBEBEB' }}>
                <Ionicons name={s.icon} size={20} color={s.iconColor} />
                <Text style={{ fontSize: 17, fontWeight: '700', color: '#1A1A1A' }}>{s.value}</Text>
                <Text style={{ fontSize: 12, color: '#999' }}>{s.label}</Text>
              </View>
            ))}
          </View>

          {/* 描述 */}
          {app.description && (
            <Text style={{ fontSize: 14, color: '#555', lineHeight: 22 }}>{app.description}</Text>
          )}
        </View>

        {/* 版本下载卡片 */}
        {releases.length > 0 && (
          <View style={{ backgroundColor: '#fff', borderRadius: 18, overflow: 'hidden',
            boxShadow: [{ offsetX: 0, offsetY: 1, blurRadius: 4, color: 'rgba(0,0,0,0.06)' }] }}>
            {releases.slice(0, 3).map((rel, relIdx) => {
              const isExpanded = expandedRelease === rel.id;
              return (
                <View key={rel.id} style={{ borderTopWidth: relIdx > 0 ? 1 : 0, borderTopColor: '#F0F0F0' }}>
                  {/* 版本标题行 */}
                  <Pressable
                    onPress={() => setExpandedRelease(isExpanded ? null : rel.id)}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 8 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: relIdx === 0 ? '#52C41A' : '#D9D9D9' }} />
                    <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: '#1A1A1A' }}>
                      最新版本 {rel.tag_name}
                    </Text>
                    <Text style={{ fontSize: 12, color: '#AAA' }}>{rel.published_at?.slice(0, 10).replace(/-/g, '/')}</Text>
                    <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color="#AAA" />
                  </Pressable>
                  {/* 资源列表 */}
                  {isExpanded && (
                    <View style={{ borderTopWidth: 0.5, borderTopColor: '#F5F5F5' }}>
                      {rel.assets.map((asset, ai) => {
                        const platform = getPlatformFromFilename(asset.name);
                        return (
                          <View key={asset.name} style={{ flexDirection: 'row', alignItems: 'center',
                            paddingHorizontal: 16, paddingVertical: 12, gap: 10,
                            borderTopWidth: ai > 0 ? 0.5 : 0, borderTopColor: '#F5F5F5' }}>
                            {/* 平台标签 */}
                            <View style={{ minWidth: 52, alignItems: 'center',
                              paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6,
                              backgroundColor: platform ? `${getPlatformColor(platform)}20` : '#F0F0F0' }}>
                              <Text style={{ fontSize: 11, fontWeight: '600',
                                color: platform ? getPlatformColor(platform) : '#888' }}>
                                {platform || '通用'}
                              </Text>
                            </View>
                            {/* 文件信息 */}
                            <View style={{ flex: 1, gap: 2 }}>
                              <Text style={{ fontSize: 13, color: '#1A1A1A', fontWeight: '500' }} numberOfLines={1}>
                                {asset.name}
                              </Text>
                              <Text style={{ fontSize: 11, color: '#AAA' }}>
                                {formatBytes(asset.size)}  {asset.download_count.toLocaleString()}次下载
                              </Text>
                            </View>
                            {/* 下载按钮 */}
                            <Pressable
                              onPress={() => Linking.openURL(asset.browser_download_url)}
                              style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
                                borderWidth: 1.5, borderColor: '#1677FF' }}>
                              <Text style={{ fontSize: 13, fontWeight: '600', color: '#1677FF' }}>下载</Text>
                            </Pressable>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* 在 GitHub 查看 */}
        <Pressable
          onPress={() => Linking.openURL(app.html_url)}
          style={{ backgroundColor: '#1A1A1A', borderRadius: 14, paddingVertical: 14,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Ionicons name="logo-github" size={20} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>在 GitHub 查看</Text>
        </Pressable>

        {/* README Markdown 渲染 */}
        {readme ? <MarkdownSection content={readme} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function getPlatformColor(platform: string): string {
  const map: Record<string, string> = {
    Android: '#3DDC84',
    iOS: '#007AFF',
    macOS: '#888888',
    Windows: '#00A4EF',
    Linux: '#E6B800',
  };
  return map[platform] || '#666';
}

import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { fetchRepoDetail, fetchReleases, fetchReadme, filterInstallAssets, getPlatformFromFilename } from '@/lib/github';
import { addFavorite, removeFavorite, isFavorite } from '@/lib/database';
import * as WebBrowser from 'expo-web-browser';
import type { AppItem, GitHubRelease } from '@/types';
import AppIcon from '@/components/openappstore/AppIcon';
import PlatformTag from '@/components/openappstore/PlatformTag';
import EmptyState from '@/components/openappstore/EmptyState';
import DownloadProgressButton from '@/components/openappstore/DownloadProgressButton';
import Markdown from 'react-native-marked';

// 过滤 README 中的徽章图片和社交媒体推广块，保留正文内容
function stripBadges(md: string): string {
  return md
    .split('\n')
    .filter((line) => {
      const lower = line.trim().toLowerCase();
      const badgeDomains = [
        'shields.io', 'img.shields.io', 'badge.fury.io', 'travis-ci',
        'codecov.io', 'coveralls.io', 'circleci.com', 'github.com/actions',
        'discord.gg', 'discord.com/invite', 'bestpractices.coreinfrastructure',
        'snyk.io', 'codeclimate.com', 'sonarcloud.io', 'pkg.go.dev/badge',
        'goreportcard.com', 'deps.rs', 'crates.io/badge', 'pypi.org/badge',
        'app.fossa.com', 'bluesky', 'twitter.com/intent', 'x.com/intent',
      ];
      const isBadgeLine = badgeDomains.some((d) => lower.includes(d));
      const isPureImage = /^(\[!\[.*?\]\(.*?\)\]\(.*?\)\s*)+$/.test(line.trim()) ||
        /^(!\[.*?\]\(https?:\/\/[^\)]+\)\s*)+$/.test(line.trim());
      return !isBadgeLine && !isPureImage;
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function formatSize(bytes: number): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

const CARD_SHADOW = [{ offsetX: 0, offsetY: 1, blurRadius: 4, color: 'rgba(0,0,0,0.07)' }] as const;

export default function DetailScreen() {
  const { id, owner, repo } = useLocalSearchParams<{ id: string; owner: string; repo: string }>();
  const router = useRouter();
  const [app, setApp] = useState<AppItem | null>(null);
  const [releases, setReleases] = useState<GitHubRelease[]>([]);
  const [releasesError, setReleasesError] = useState('');
  const [readme, setReadme] = useState('');
  const [loading, setLoading] = useState(true);
  const [favorited, setFavorited] = useState(false);
  const [activeTab, setActiveTab] = useState<'readme' | 'releases'>('releases');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const numericId = Number(id);
        if (!owner || !repo) { setLoading(false); return; }
        const detail = await fetchRepoDetail(owner, repo);
        setApp(detail);
        setFavorited(await isFavorite(numericId));
        // 独立 catch：releases 和 readme 互不影响，任何一个失败不阻断另一个
        const [relsResult, rm] = await Promise.all([
          fetchReleases(owner, repo, 1).catch((e: any) => {
            setReleasesError(e?.message || '版本加载失败');
            return [] as GitHubRelease[];
          }),
          fetchReadme(owner, repo).catch(() => ''),
        ]);
        setReleases(relsResult);
        setReadme(stripBadges(rm));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, owner, repo]);

  const handleFavorite = async () => {
    if (!app) return;
    if (favorited) {
      await removeFavorite(app.id);
      setFavorited(false);
    } else {
      await addFavorite({
        app_id: app.id, app_name: app.name, owner: app.owner, repo: app.repo,
        avatar_url: app.avatar_url, description: app.description,
        stars: app.stars, language: app.language, platforms: app.platforms,
      });
      setFavorited(true);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' }} edges={['top']}>
        <ActivityIndicator size="large" color="#1677FF" />
      </SafeAreaView>
    );
  }

  if (!app) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F5F5' }} edges={['top']}>
        <Pressable onPress={() => router.back()} style={{ padding: 16 }}>
          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
        </Pressable>
        <EmptyState title="应用不存在" />
      </SafeAreaView>
    );
  }

  const latestRelease = releases[0];
  const latestAssets = latestRelease ? filterInstallAssets(latestRelease.assets) : [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F5F5' }} edges={['top']}>
      {/* 顶部导航：返回 + 标题 + 收藏图标 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 8 }}>
        <Pressable
          onPress={() => router.back()}
          style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 }}
        >
          <Ionicons name="arrow-back" size={22} color="#1A1A1A" />
        </Pressable>
        <Text style={{ flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '600', color: '#1A1A1A' }} numberOfLines={1}>
          {app.name}
        </Text>
        {/* 收藏按钮 — 图标形式，放在导航栏右侧 */}
        <Pressable
          onPress={handleFavorite}
          style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 }}
        >
          <Ionicons
            name={favorited ? 'heart' : 'heart-outline'}
            size={22}
            color={favorited ? '#FF4D4F' : '#888888'}
          />
        </Pressable>
      </View>

      <ScrollView contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false}>

        {/* ── 应用信息卡片 ── */}
        <View style={{
          marginHorizontal: 16, marginTop: 4, padding: 20,
          backgroundColor: '#FFFFFF', borderRadius: 20, boxShadow: CARD_SHADOW,
        }}>
          {/* 图标 + 名称 + 平台 */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 16 }}>
            <AppIcon owner={app.owner} repo={app.repo} url={app.avatar_url} name={app.name} size={76} />
            <View style={{ flex: 1, gap: 6, paddingTop: 2 }}>
              <Text style={{ fontSize: 19, fontWeight: '700', color: '#1A1A1A', lineHeight: 24 }} numberOfLines={2}>
                {app.name}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                {app.platforms.map((p) => <PlatformTag key={p} platform={p} />)}
              </View>
            </View>
          </View>

          {/* 统计数据行：Star / Fork / 语言 */}
          <View style={{
            flexDirection: 'row', marginTop: 16,
            paddingVertical: 12, borderRadius: 14,
            backgroundColor: '#F8F9FB',
          }}>
            {[
              { icon: 'star' as const, color: '#FAAD14', value: formatNumber(app.stars), label: 'Stars' },
              { icon: 'git-branch-outline' as const, color: '#52C41A', value: formatNumber(app.forks), label: 'Forks' },
              { icon: 'code-slash-outline' as const, color: '#1677FF', value: app.language || '—', label: '语言' },
            ].map((item, i) => (
              <View key={i} style={{ flex: 1, alignItems: 'center', gap: 4,
                borderRightWidth: i < 2 ? 1 : 0, borderRightColor: '#EBEBEB' }}>
                <Ionicons name={item.icon} size={16} color={item.color} />
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#1A1A1A' }}>{item.value}</Text>
                <Text style={{ fontSize: 11, color: '#999999' }}>{item.label}</Text>
              </View>
            ))}
          </View>

          {/* 描述 */}
          {app.description ? (
            <Text style={{ fontSize: 14, color: '#555555', lineHeight: 21, marginTop: 14 }}>
              {app.description}
            </Text>
          ) : null}
        </View>

        {/* ── 最新版本快捷下载 ── */}
        {latestAssets.length > 0 && (
          <View style={{
            marginHorizontal: 16, marginTop: 12,
            backgroundColor: '#FFFFFF', borderRadius: 16, boxShadow: CARD_SHADOW, overflow: 'hidden',
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, gap: 8 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#52C41A' }} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#1A1A1A', flex: 1 }}>
                最新版本 {latestRelease.tag_name}
              </Text>
              <Text style={{ fontSize: 12, color: '#999999' }}>
                {new Date(latestRelease.published_at).toLocaleDateString('zh-CN')}
              </Text>
            </View>
            <View style={{ height: 1, backgroundColor: '#F0F0F0', marginHorizontal: 16 }} />
            {latestAssets.map((asset, idx) => {
              const platform = getPlatformFromFilename(asset.name);
              const isLast = idx === latestAssets.length - 1;
              return (
                <View
                  key={asset.name}
                  style={{
                    flexDirection: 'row', alignItems: 'center',
                    paddingHorizontal: 16, paddingVertical: 12,
                    borderBottomWidth: isLast ? 0 : 1, borderBottomColor: '#F7F7F7', gap: 10,
                  }}
                >
                  {platform ? <PlatformTag platform={platform} /> : (
                    <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: '#F5F5F5' }}>
                      <Text style={{ fontSize: 11, color: '#888888' }}>通用</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, color: '#333333', fontWeight: '500' }} numberOfLines={1}>{asset.name}</Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 2 }}>
                      {asset.size ? <Text style={{ fontSize: 11, color: '#999999' }}>{formatSize(asset.size)}</Text> : null}
                      {asset.download_count > 0 ? <Text style={{ fontSize: 11, color: '#999999' }}>{asset.download_count.toLocaleString()} 次下载</Text> : null}
                    </View>
                  </View>
                  <DownloadProgressButton
                    downloadUrl={asset.browser_download_url}
                    filename={asset.name}
                    appId={app.id}
                    appName={app.name}
                    owner={app.owner}
                    repo={app.repo}
                    avatarUrl={app.avatar_url}
                    version={latestRelease.tag_name}
                  />
                </View>
              );
            })}
          </View>
        )}

        {/* ── GitHub 仓库链接 ── */}
        <Pressable
          onPress={() => WebBrowser.openBrowserAsync(app.html_url)}
          style={{
            marginHorizontal: 16, marginTop: 12, paddingHorizontal: 16, paddingVertical: 13,
            backgroundColor: '#FFFFFF', borderRadius: 16,
            flexDirection: 'row', alignItems: 'center', gap: 10,
            boxShadow: CARD_SHADOW,
          }}
        >
          <Ionicons name="logo-github" size={20} color="#1A1A1A" />
          <Text style={{ flex: 1, fontSize: 13, color: '#444444' }} numberOfLines={1}>{app.html_url}</Text>
          <Ionicons name="chevron-forward" size={16} color="#CCCCCC" />
        </Pressable>

        {/* ── Tab 切换 ── */}
        <View style={{
          flexDirection: 'row', marginHorizontal: 16, marginTop: 16,
          backgroundColor: '#EFEFEF', borderRadius: 12, padding: 3,
        }}>
          {(['releases', 'readme'] as const).map((tab) => {
            const active = activeTab === tab;
            return (
              <Pressable
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={{
                  flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10,
                  backgroundColor: active ? '#FFFFFF' : 'transparent',
                  boxShadow: active ? [{ offsetX: 0, offsetY: 1, blurRadius: 3, color: 'rgba(0,0,0,0.08)' }] : undefined,
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: active ? '600' : '400', color: active ? '#1677FF' : '#888888' }}>
                  {tab === 'releases' ? '全部版本' : 'README'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* ── 内容区 ── */}
        <View style={{ marginHorizontal: 16, marginTop: 12, paddingBottom: 40 }}>
          {activeTab === 'readme' ? (
            readme ? (
              <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, boxShadow: CARD_SHADOW }}>
                <Markdown
                  value={readme}
                  styles={{
                    text: { fontSize: 14, lineHeight: 22, color: '#333333' },
                    h1: { fontSize: 20, fontWeight: '700', color: '#1A1A1A' },
                    h2: { fontSize: 17, fontWeight: '600', color: '#1A1A1A' },
                    h3: { fontSize: 15, fontWeight: '600', color: '#333333' },
                    codespan: { backgroundColor: '#F3F4F6', borderRadius: 4, fontSize: 13 },
                    code: { backgroundColor: '#F3F4F6', borderRadius: 8 },
                    blockquote: { borderLeftWidth: 3, paddingLeft: 12, backgroundColor: '#EBF3FF' },
                  }}
                />
              </View>
            ) : (
              <EmptyState title="暂无 README 文档" />
            )
          ) : releases.length > 0 ? (
            releases.map((r) => {
              const installAssets = filterInstallAssets(r.assets);
              return (
                <View key={r.id} style={{ backgroundColor: '#FFFFFF', borderRadius: 16, marginBottom: 12, boxShadow: CARD_SHADOW, overflow: 'hidden' }}>
                  {/* 版本号 + 发布时间 */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: installAssets.length > 0 ? 1 : 0, borderBottomColor: '#F0F0F0', gap: 8 }}>
                    <View style={{ paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, backgroundColor: '#EBF3FF' }}>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: '#1677FF' }}>{r.tag_name}</Text>
                    </View>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#1A1A1A', flex: 1 }} numberOfLines={1}>
                      {r.name || r.tag_name}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="time-outline" size={12} color="#999999" />
                      <Text style={{ fontSize: 12, color: '#999999' }}>
                        {new Date(r.published_at).toLocaleDateString('zh-CN')}
                      </Text>
                    </View>
                  </View>
                  {/* 安装包列表 */}
                  {installAssets.length > 0 ? (
                    installAssets.map((asset, idx) => {
                      const platform = getPlatformFromFilename(asset.name);
                      const isLast = idx === installAssets.length - 1;
                      return (
                        <View
                          key={asset.name}
                          style={{
                            flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
                            borderBottomWidth: isLast ? 0 : 1, borderBottomColor: '#F7F7F7', gap: 10,
                          }}
                        >
                          {platform ? <PlatformTag platform={platform} /> : (
                            <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: '#F5F5F5' }}>
                              <Text style={{ fontSize: 11, color: '#888888' }}>通用</Text>
                            </View>
                          )}
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 13, color: '#333333', fontWeight: '500' }} numberOfLines={1}>{asset.name}</Text>
                            <View style={{ flexDirection: 'row', gap: 8, marginTop: 2 }}>
                              {asset.size ? <Text style={{ fontSize: 11, color: '#999999' }}>{formatSize(asset.size)}</Text> : null}
                              {asset.download_count > 0 ? <Text style={{ fontSize: 11, color: '#999999' }}>{asset.download_count.toLocaleString()} 次下载</Text> : null}
                            </View>
                          </View>
                          <DownloadProgressButton
                            downloadUrl={asset.browser_download_url}
                            filename={asset.name}
                            appId={app.id}
                            appName={app.name}
                            owner={app.owner}
                            repo={app.repo}
                            avatarUrl={app.avatar_url}
                            version={r.tag_name}
                          />
                        </View>
                      );
                    })
                  ) : (
                    <View style={{ padding: 16 }}>
                      <Text style={{ fontSize: 13, color: '#999999', textAlign: 'center' }}>该版本暂无安装包</Text>
                    </View>
                  )}
                </View>
              );
            })
          ) : releasesError ? (
            <View style={{ margin: 4, padding: 16, borderRadius: 14, backgroundColor: '#FFF2F0', borderWidth: 1, borderColor: '#FFCCC7' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Ionicons name="warning-outline" size={16} color="#FF4D4F" />
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#FF4D4F' }}>版本信息加载失败</Text>
              </View>
              <Text style={{ fontSize: 12, color: '#7A0000', lineHeight: 18 }}>{releasesError}</Text>
            </View>
          ) : (
            <EmptyState title="暂无安装包" description="该项目尚未发布正式版本" />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}


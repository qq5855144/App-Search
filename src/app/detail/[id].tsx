import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, Linking, Platform, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAndroidGoBack } from '@/hooks/useAndroidGoBack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { fetchRepoDetail, fetchReleases, fetchReadme, getPlatformFromFilename, filterInstallAssets, filterVerificationAssets, checkIfStarred, starRepo, unstarRepo } from '@/lib/github';
import { addFavorite, removeFavorite, isFavorite, addDownloadRecord } from '@/lib/database';
import { addAppEvent } from '@/lib/events';
import type { AppItem, GitHubRelease } from '@/types';
import AppIcon from '@/components/openappstore/AppIcon';
import PlatformTag from '@/components/openappstore/PlatformTag';
import { useDownload } from '@/ctx/DownloadContext';
import { useTranslation } from '@/ctx/TranslationContext';

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatCount(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

// ─── WebView README 渲染：使用 marked + highlight.js 完整支持 GFM ─────────────
import { WebView } from 'react-native-webview';

/**
 * GitHub Flavored Markdown 渲染器
 * 使用 WebView + marked + highlight.js 完整支持：
 *  - 表格、任务列表、删除线、表情符号
 *  - 代码块语法高亮（highlight.js）
 *  - Alerts/Admonitions（NOTE/TIP/WARNING）
 *  - 图片（shields.io 强制 PNG）
 *  - 相对链接自动补全 baseUrl
 * 渲染效果与 GitHub 一致。
 */
function MarkdownWebView({ content, owner, repo }: { content: string; owner: string; repo: string }) {
  const [webViewHeight, setWebViewHeight] = useState(200);
  const { width } = useWindowDimensions();

  if (!content) return null;

  // 预处理：去除 YAML frontmatter
  const cleaned = content.replace(/^---[\s\S]*?---\r?\n?/, '').trim();
  if (!cleaned) return null;

  const baseUrl = `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/`;

  // 转义 markdown 内容以安全注入 HTML
  const escapedMd = cleaned
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$')
    .replace(/<\/(script|style)>/gi, '<\\/$1>');

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/marked/12.0.2/marked.min.js"><\/script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"><\/script>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif;
    font-size: 14px; line-height: 1.6; color: #1F2328;
    padding: 0; margin: 0; word-wrap: break-word; overflow-wrap: break-word;
  }
  h1 { font-size: 1.8em; border-bottom: 1px solid #d8dee4; padding-bottom: .3em; margin: 24px 0 16px; }
  h2 { font-size: 1.4em; border-bottom: 1px solid #d8dee4; padding-bottom: .3em; margin: 24px 0 16px; }
  h3 { font-size: 1.15em; margin: 24px 0 16px; }
  h4 { font-size: 1em; margin: 24px 0 16px; }
  p { margin: 0 0 12px; }
  a { color: #0969da; text-decoration: none; }
  a:hover { text-decoration: underline; }
  img { max-width: 100%; height: auto; }
  code { font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace; font-size: 85%; background: rgba(175,184,193,0.2); border-radius: 3px; padding: 2px 4px; }
  pre { background: #f6f8fa; border-radius: 6px; padding: 12px; overflow-x: auto; }
  pre code { background: none; padding: 0; font-size: 85%; }
  table { border-collapse: collapse; width: 100%; margin: 8px 0; }
  th, td { border: 1px solid #d8dee4; padding: 6px 10px; text-align: left; }
  th { background: #f6f8fa; font-weight: 600; }
  tr:nth-child(even) { background: #f8f9fa; }
  blockquote { border-left: 4px solid #d8dee4; margin: 0 0 12px; padding: 0 12px; color: #656d76; }
  ul, ol { padding-left: 24px; margin: 0 0 12px; }
  li { margin: 2px 0; }
  hr { border: none; border-top: 1px solid #d8dee4; margin: 24px 0; }
  .task-list-item { list-style: none; margin-left: -20px; }
  .task-list-item input { margin-right: 6px; }
  /* GitHub Alerts */
  .markdown-alert { padding: 8px 16px; margin: 8px 0; border-left: 4px solid; border-radius: 4px; }
  .markdown-alert-note { background: #ddf4ff; border-color: #0969da; }
  .markdown-alert-tip { background: #dafbe1; border-color: #1a7f37; }
  .markdown-alert-warning { background: #fff8c5; border-color: #9a6700; }
  .markdown-alert-caution { background: #ffebe9; border-color: #cf222e; }
  .markdown-alert-title { font-weight: 600; margin-bottom: 4px; }
</style>
</head>
<body>
<div id="content"></div>
<script>
  marked.setOptions({
    gfm: true,
    breaks: false,
    highlight: function(code, lang) {
      if (lang && hljs.getLanguage(lang)) {
        try { return hljs.highlight(code, { language: lang }).value; }
        catch(e) { /* fall through */ }
      }
      return hljs.highlightAuto(code).value;
    }
  });

  var md = \`${escapedMd}\`;

  // 相对链接补全 baseUrl
  md = md.replace(/\\]\\\\(((?!https?:\\/\\/)[^)]+)\\\\)/g, function(m, p1) {
    return '](' + '${baseUrl.replace(/'/g, "\\'")}' + p1 + ')';
  });

  // 图片链接补全
  md = md.replace(/!\\[[^\\]]*\\]\\(((?!https?:\\/\\/)[^)]+)\\)/g, function(m, p1) {
    return m.replace(p1, '${baseUrl.replace(/'/g, "\\'")}' + p1);
  });

  document.getElementById('content').innerHTML = marked.parse(md);

  // 转 shields.io SVG → PNG
  document.querySelectorAll('img').forEach(function(img) {
    if (/shields\\.io|badge\\.svg|badgen\\.net/i.test(img.src)) {
      img.src = img.src + (img.src.includes('?') ? '&format=png' : '?format=png');
    }
  });

  // 通知 RN 高度
  setTimeout(function() {
    var h = document.body.scrollHeight;
    window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'height', height: h }));
  }, 200);
</script>
</body>
</html>`;

  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, marginTop: 4 }}>
      <Text style={{ fontSize: 15, fontWeight: '700', color: '#1A1A1A', marginBottom: 10 }}>README</Text>
      <WebView
        source={{ html }}
        style={{ width: width - 64, height: webViewHeight }}
        scrollEnabled={false}
        javaScriptEnabled={true}
        originWhitelist={['*']}
        onMessage={(e) => {
          try {
            const data = JSON.parse(e.nativeEvent.data);
            if (data.type === 'height' && data.height > 0) {
              setWebViewHeight(data.height);
            }
          } catch { /* ignore */ }
        }}
        onError={() => {}}
      />
    </View>
  );
}

export default function DetailScreen() {
  useAndroidGoBack();

  const { owner, repo } = useLocalSearchParams<{ owner: string; repo: string }>();
  const router = useRouter();
  const { enqueue, findByUrl } = useDownload();
  const { translate, enabled, targetLang } = useTranslation();
  // 直接打开详情页时导航栈为空，canGoBack() 为 false → 回首页而非 back()
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/home' as any);
  };
  const [app, setApp] = useState<AppItem | null>(null);
  const [releases, setReleases] = useState<GitHubRelease[]>([]);
  // 未经 installable 过滤的原始最新 release，用于项目信息区显示真实最新版本
  const [latestRawRelease, setLatestRawRelease] = useState<GitHubRelease | null>(null);
  const [readme, setReadme] = useState('');
  const [loading, setLoading] = useState(true);
  const [favored, setFavored] = useState(false);
  const [error, setError] = useState('');
  const [expandedRelease, setExpandedRelease] = useState<number | null>(null);
  // 翻译后的展示文本（翻译关闭时等于原文）
  const [displayDesc, setDisplayDesc] = useState('');
  const [displayReadme, setDisplayReadme] = useState('');

  useEffect(() => {
    if (!owner || !repo) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError('');
        const [detail, rels, md] = await Promise.all([
          fetchRepoDetail(owner, repo),
          fetchReleases(owner, repo, 1, true).catch(() => [] as GitHubRelease[]),
          fetchReadme(owner, repo).catch(() => ''),
        ]);
        if (cancelled) return;
        setApp(detail);
        // Record view event
        addAppEvent({ event_type: 'view', app_id: detail.id, app_name: detail.name, owner: owner ?? '', repo: repo ?? '', avatar_url: detail.avatar_url ?? '' }).catch(() => {});
        const installRels = rels.map((r) => ({
          ...r,
          assets: filterInstallAssets(r.assets),
          verification_assets: filterVerificationAssets(r.assets),
        })).filter((r) => r.assets.length > 0);
        // 保留未过滤的首条 release 用于项目信息区（真实最新版本，含无安装包的版本）
        setLatestRawRelease(rels[0] ?? null);
        setReleases(installRels);
        if (installRels.length > 0) setExpandedRelease(installRels[0].id);
        setReadme(md);
        const f = await isFavorite(detail.id).catch(() => false);
        // 有 Token 时以 GitHub 实际 star 状态为准，并同步本地收藏
        const ghStarred = await checkIfStarred(detail.owner, detail.repo);
        if (ghStarred !== null) {
          // GitHub 已 star 但本地未收藏 → 补录本地
          if (ghStarred && !f) await addFavorite(detail).catch(() => {});
          // 本地收藏但 GitHub 未 star → 以 GitHub 为准，清除本地
          if (!ghStarred && f) await removeFavorite(detail.id).catch(() => {});
          setFavored(ghStarred);
        } else {
          setFavored(f);
        }
      } catch (e: any) {
        if (cancelled) return;
        const msg = e?.message || '加载失败';
        // 识别速率限制错误
        if (msg.includes('上限') || msg.includes('rate limit') || msg.includes('403')) {
          setError('GitHub API 请求次数已达上限，请稍后再试或在「我的」页面配置 Token');
        } else {
          setError(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [owner, repo]);

  // 翻译描述和 README（enabled/targetLang/原文 任一变化时重新执行）
  useEffect(() => {
    (async () => {
      const desc = app?.description || '';
      if (!enabled) {
        setDisplayDesc(desc);
        setDisplayReadme(readme);
        return;
      }
      const [td, tr] = await Promise.all([
        desc ? translate(desc) : Promise.resolve(''),
        readme ? translate(readme) : Promise.resolve(''),
      ]);
      setDisplayDesc(td);
      setDisplayReadme(tr);
    })();
  }, [app?.description, readme, enabled, targetLang]);

  const toggleFav = async () => {
    if (!app) return;
    if (favored) {
      // 取消收藏：本地移除 + 取消 GitHub Star（有 Token 时）
      await removeFavorite(app.id);
      setFavored(false);
      unstarRepo(app.owner, app.repo).catch(() => {});
      addAppEvent({ event_type: 'favorite', app_id: app.id, app_name: app.name, owner: owner ?? '', repo: repo ?? '', avatar_url: app.avatar_url ?? '' }).catch(() => {});
    } else {
      // 添加收藏：本地保存 + 给 GitHub 打 Star（有 Token 时）
      await addFavorite(app);
      setFavored(true);
      starRepo(app.owner, app.repo).catch(() => {});
      addAppEvent({ event_type: 'favorite', app_id: app.id, app_name: app.name, owner: owner ?? '', repo: repo ?? '', avatar_url: app.avatar_url ?? '' }).catch(() => {});
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
        <Pressable onPress={goBack} style={{ backgroundColor: '#1677FF', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 }}>
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
        <Pressable onPress={goBack} hitSlop={12} style={{ marginRight: 12 }}>
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
            <AppIcon owner={app.owner} url={app.avatar_url} name={app.name} size={80} />
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
            <Text style={{ fontSize: 14, color: '#555', lineHeight: 22 }}>{displayDesc || app.description}</Text>
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
                      {relIdx === 0 ? '最新版本' : '历史版本'}{' '}
                      {rel.tag_name === 'latest'
                        ? `${rel.published_at?.slice(0, 10).replace(/-/g, '/') ?? 'latest'} 构建`
                        : rel.tag_name.replace(/^v/i, '')}
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
                              onPress={async () => {
                                if (!app) return;
                                // 检查是否已在下载队列或已完成
                                const existing = findByUrl(asset.browser_download_url);
                                if (existing && existing.status !== 'failed' && existing.status !== 'cancelled') {
                                  // 进行中 / 已完成 / 已暂停 → 跳转下载页查看，不重复入队
                                  router.push('/downloads' as any);
                                  return;
                                }
                                // 加入 App 内下载队列（不跳浏览器）
                                try {
                                  addDownloadRecord({
                                    app_id: app.id,
                                    app_name: app.name,
                                    owner: owner ?? '',
                                    repo: repo ?? '',
                                    avatar_url: app.avatar_url,
                                    version: rel.tag_name,
                                    download_time: new Date().toISOString(),
                                    file_size: asset.size,
                                    html_url: asset.browser_download_url,
                                  }).catch(() => {});
                                  addAppEvent({ event_type: 'download', app_id: app.id, app_name: app.name, owner: owner ?? '', repo: repo ?? '', avatar_url: app.avatar_url ?? '' }).catch(() => {});
                                  await enqueue({
                                    url: asset.browser_download_url,
                                    filename: asset.name,
                                    appId: app.id,
                                    appName: app.name,
                                    owner: owner ?? '',
                                    repo: repo ?? '',
                                    avatarUrl: app.avatar_url ?? '',
                                    version: rel.tag_name,
                                  });
                                  router.push('/downloads' as any);
                                } catch (e: any) {
                                  // 下载链接无效时不跳转，错误已在 enqueue 中抛出
                                  console.warn('[Detail] 下载失败:', e?.message);
                                }
                              }}
                              style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
                                borderWidth: 1.5, borderColor: '#1677FF' }}>
                              <Text style={{ fontSize: 13, fontWeight: '600', color: '#1677FF' }}>下载</Text>
                            </Pressable>
                          </View>
                        );
                      })}
                      {/* 签名/校验文件提示 */}
                      {(rel.verification_assets?.length ?? 0) > 0 && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8,
                          paddingHorizontal: 16, paddingVertical: 10,
                          borderTopWidth: 0.5, borderTopColor: '#F5F5F5',
                          backgroundColor: '#F6FFED' }}>
                          <Ionicons name="shield-checkmark-outline" size={14} color="#52C41A" />
                          <Text style={{ fontSize: 12, color: '#389E0D', flex: 1 }}>
                            此版本提供签名/哈希校验文件（
                            {rel.verification_assets!.map((v) => v.name).join('、')}
                            ），可用于验证安装包完整性
                          </Text>
                        </View>
                      )}
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

        {/* 可信信息卡：License / 更新时间 / 安全提示 */}
        <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 10,
          boxShadow: [{ offsetX: 0, offsetY: 1, blurRadius: 4, color: 'rgba(0,0,0,0.06)' }] }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#1A1A1A', marginBottom: 2 }}>项目信息</Text>
          {[
            { icon: 'document-text-outline' as const, color: '#1677FF', label: '许可证', value: app.license || '未知' },
            { icon: 'time-outline' as const, color: '#00B96B', label: '最近更新', value: app.updated_at ? app.updated_at.slice(0, 10).replace(/-/g, '/') : '-' },
            { icon: 'git-branch-outline' as const, color: '#FA8C16', label: '最新版本',
              value: latestRawRelease?.tag_name === 'latest'
                ? `${latestRawRelease?.published_at?.slice(0, 10).replace(/-/g, '/') ?? '-'} 构建`
                : (latestRawRelease?.tag_name?.replace(/^v/i, '') || '-') },
            { icon: 'calendar-outline' as const, color: '#722ED1', label: '发布时间', value: latestRawRelease?.published_at ? latestRawRelease.published_at.slice(0, 10).replace(/-/g, '/') : '-' },
          ].map((row) => (
            <View key={row.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name={row.icon} size={16} color={row.color} />
              <Text style={{ fontSize: 13, color: '#888', width: 64 }}>{row.label}</Text>
              <Text style={{ fontSize: 13, color: '#333', fontWeight: '500', flex: 1 }}>{row.value}</Text>
            </View>
          ))}
          {/* 安全提示 */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 4,
            backgroundColor: '#FFFBE6', borderRadius: 8, padding: 10 }}>
            <Ionicons name="warning-outline" size={15} color="#FA8C16" style={{ marginTop: 1 }} />
            <Text style={{ fontSize: 12, color: '#8D6E0A', flex: 1, lineHeight: 18 }}>
              安装包来自 GitHub Release，请确认来源可信后再安装，建议仅安装您熟悉的开源项目。
            </Text>
          </View>
        </View>

        {/* README Markdown 渲染 */}
        {(displayReadme || readme) ? <MarkdownWebView content={displayReadme || readme} owner={owner ?? ''} repo={repo ?? ''} /> : null}
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

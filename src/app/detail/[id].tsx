import React, { useEffect, useState, type ReactNode } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, Linking, Platform, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { fetchRepoDetail, fetchReleases, fetchReadme, getPlatformFromFilename, filterInstallAssets, filterVerificationAssets } from '@/lib/github';
import { addFavorite, removeFavorite, isFavorite, addDownloadRecord } from '@/lib/database';
import { addAppEvent } from '@/lib/events';
import type { AppItem, GitHubRelease } from '@/types';
import AppIcon from '@/components/openappstore/AppIcon';
import PlatformTag from '@/components/openappstore/PlatformTag';
import Marked, { Renderer } from 'react-native-marked';
import { Image } from 'expo-image';
import type { ImageStyle } from 'react-native';
import { useDownload } from '@/ctx/DownloadContext';

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatCount(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

// ─── 自定义 Renderer：解决 shields.io SVG 徽章不显示的根本问题 ────────────────
class AppRenderer extends Renderer {
  constructor() {
    super(); // 必须调用，初始化基类 Slugger
  }

  // 覆盖 image：使用 expo-image 替代 react-native Image，shields.io 强制 PNG 格式
  image(uri: string, alt?: string, _style?: ImageStyle): ReactNode {
    const key = this.getKey(); // 使用基类 Slugger 生成唯一 key，避免重复 key 渲染异常
    let src = uri;
    // shields.io / badge 相关 URL 默认返回 SVG，react-native 无法渲染 → 强制转 PNG
    if (/shields\.io|badge\.svg|gitcode\.com.*badge|badgen\.net/i.test(src)) {
      src = src.includes('?') ? src + '&format=png' : src + '?format=png';
    }
    return (
      <Image
        key={key}
        source={{ uri: src }}
        style={{ height: 20, minWidth: 20, maxWidth: '100%' as unknown as number }}
        contentFit="contain"
        transition={200}
      />
    );
  }
}

/**
 * 预处理 Markdown（完整重写版）：
 * 核心思路：把 HTML 转换为等效 Markdown，而不是直接丢弃
 * 1. 去除 YAML frontmatter
 * 2. GitHub Admonitions `> [!NOTE]` → 普通 blockquote
 * 3. `<a><img></a>` / `<img>` → `![alt](src)`（让 react-native-marked 渲染图片）
 * 4. `<a href>text</a>` → `[text](href)`（保留链接）
 * 5. HTML 标题标签 → Markdown 标题
 * 6. 剥除剩余 HTML 标签（保留文字内容）
 * 7. 清理多余空行
 */
function preprocessMarkdown(md: string): string {
  let s = md;

  // 1. YAML frontmatter（--- ... ---）
  s = s.replace(/^---[\s\S]*?---\r?\n?/, '');

  // 2. GitHub Admonitions
  s = s.replace(/^>\s*\[!(NOTE|TIP|WARNING|CAUTION|IMPORTANT)\]\s*$/gm, (_, type) => {
    const labels: Record<string, string> = {
      NOTE: 'ℹ️ 注意', TIP: '✅ 提示', WARNING: '⚠️ 警告',
      CAUTION: '⚠️ 警告', IMPORTANT: '❗ 重要',
    };
    return `> **${labels[type] ?? type}**`;
  });

  // 3a. <a href="URL"><img src="SRC" alt="ALT"></a>  →  [![ALT](SRC)](URL)
  s = s.replace(
    /<a[^>]+href="([^"]*)"[^>]*>\s*<img[^>]+src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>\s*<\/a>/gi,
    (_, href, src, alt) => (src ? `[![${alt}](${src})](${href})` : ''),
  );
  // alt 在 src 之后的写法
  s = s.replace(
    /<a[^>]+href="([^"]*)"[^>]*>\s*<img[^>]+alt="([^"]*)"[^>]+src="([^"]*)"[^>]*\/?>\s*<\/a>/gi,
    (_, href, alt, src) => (src ? `[![${alt}](${src})](${href})` : ''),
  );

  // 3b. 单独的 <img src="SRC" alt="ALT"> → ![ALT](SRC)
  s = s.replace(
    /<img[^>]+src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi,
    (_, src, alt) => (src ? `![${alt || 'img'}](${src})` : ''),
  );
  s = s.replace(
    /<img[^>]+alt="([^"]*)"[^>]+src="([^"]*)"[^>]*\/?>/gi,
    (_, alt, src) => (src ? `![${alt || 'img'}](${src})` : ''),
  );
  // 没有 alt 属性的 img
  s = s.replace(/<img[^>]+src="([^"]*)"[^>]*\/?>/gi, (_, src) => (src ? `![img](${src})` : ''));

  // 4. <a href="URL">text</a> → [text](URL)（只针对纯文本内容，嵌套 img 已在步骤 3 处理）
  s = s.replace(/<a[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, inner) => {
    const text = inner.replace(/<[^>]+>/g, '').trim();
    return text ? `[${text}](${href})` : '';
  });

  // 5. HTML 标题标签 → Markdown 标题
  s = s.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_, c) => `\n# ${c.replace(/<[^>]+>/g, '').trim()}\n`);
  s = s.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_, c) => `\n## ${c.replace(/<[^>]+>/g, '').trim()}\n`);
  s = s.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_, c) => `\n### ${c.replace(/<[^>]+>/g, '').trim()}\n`);
  s = s.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, (_, c) => `\n#### ${c.replace(/<[^>]+>/g, '').trim()}\n`);

  // 6. 段落/换行标签 → 换行；列表结构：</li> 先转换确保内容后有换行，再处理容器标签，最后 <li> 转 "- "
  s = s.replace(/<\/p>/gi, '\n');
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<\/li>/gi, '\n');
  s = s.replace(/<\/?ul[^>]*>/gi, '\n');
  s = s.replace(/<\/?ol[^>]*>/gi, '\n');
  s = s.replace(/<li[^>]*>/gi, '- ');

  // 7. 剥除剩余所有 HTML 标签（保留文字）
  s = s.replace(/<[^>]+>/g, '');

  // 8. 反转义常见 HTML 实体
  s = s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ');

  // 9. 清理多余空行
  return s.replace(/\n{3,}/g, '\n\n').trim();
}

/** 将 Markdown 表格转换为带样式的 HTML 表格（仅用于 Web 平台） */
function convertMarkdownTableToHtml(text: string): string {
  // 匹配：header行 + 分隔行（|---|...）+ 若干数据行
  return text.replace(
    /^(\|.+\|\s*\n)(^\|[\s\-:|]+\|\s*\n)((?:^\|.+\|\s*\n?)+)/gm,
    (_, headerLine, _sep, dataBlock) => {
      const parseRow = (line: string) =>
        line.split('|').slice(1, -1).map((c) => c.trim());

      const headers = parseRow(headerLine);
      const rows = dataBlock
        .trim()
        .split('\n')
        .filter((l: string) => l.trim().startsWith('|'))
        .map(parseRow);

      const thStyle =
        'padding:6px 10px;text-align:left;background:#F8F9FA;font-size:13px;font-weight:600;color:#333;border:1px solid #E5E7EB;white-space:nowrap';
      const tdStyle =
        'padding:6px 10px;font-size:13px;color:#555;border:1px solid #E5E7EB;vertical-align:top';

      const thead = `<tr>${headers.map((h) => `<th style="${thStyle}">${h}</th>`).join('')}</tr>`;
      const tbody = rows
        .map((row: string[]) => `<tr>${row.map((cell) => `<td style="${tdStyle}">${cell}</td>`).join('')}</tr>`)
        .join('');

      return `<div style="overflow-x:auto;margin:10px 0"><table style="border-collapse:collapse;width:100%"><thead>${thead}</thead><tbody>${tbody}</tbody></table></div>\n`;
    },
  );
}

/** Markdown 渲染区，兼容 Native（react-native-marked + 自定义 Renderer）和 Web（dangerouslySetInnerHTML） */
function MarkdownSection({ content, owner, repo }: { content: string; owner: string; repo: string }) {
  const { width } = useWindowDimensions();
  if (!content) return null;
  const cleaned = preprocessMarkdown(content);
  if (!cleaned) return null;
  const baseUrl = `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/`;

  // ── Web 平台 ──────────────────────────────────────────────────────────────
  if (Platform.OS === 'web') {
    // 步骤1：保护图片语法，避免后续 HTML 转义破坏 URL
    const rawImages: string[] = [];
    let withImgPlaceholders = cleaned.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => {
      const idx = rawImages.length;
      rawImages.push(`<img src="${src}" alt="${alt}" style="height:20px;vertical-align:middle;margin:1px 3px 1px 0" />`);
      return `%%IMG${idx}%%`;
    });

    // 步骤2：在转义前先转换 Markdown 表格 → HTML（转义后 | 变成 &#124; 会破坏表格）
    const rawTables: string[] = [];
    withImgPlaceholders = convertMarkdownTableToHtml(withImgPlaceholders).replace(
      /<div style="overflow-x:auto[\s\S]*?<\/div>\n?/g,
      (match) => {
        const idx = rawTables.length;
        rawTables.push(match);
        return `%%TABLE${idx}%%`;
      },
    );

    // 步骤3：转义普通文本中的 HTML 特殊字符，再做 Markdown → HTML 转换
    let html = withImgPlaceholders
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/^#{3}\s+(.+)$/gm, '<h3 style="font-size:14px;font-weight:700;margin:12px 0 4px;color:#111">$1</h3>')
      .replace(/^#{2}\s+(.+)$/gm, '<h2 style="font-size:16px;font-weight:700;margin:14px 0 6px;color:#111">$1</h2>')
      .replace(/^#\s+(.+)$/gm, '<h1 style="font-size:18px;font-weight:700;margin:16px 0 8px;color:#111">$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code style="background:#F4F4F4;border-radius:3px;padding:1px 5px;font-size:12px">$1</code>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" style="color:#1677FF;text-decoration:none">$1</a>')
      .replace(/^---+$/gm, '<hr style="border:none;border-top:1px solid #E5E7EB;margin:12px 0"/>')
      .replace(/^- (.+)$/gm, '<li style="margin:2px 0;font-size:14px;color:#555">$1</li>')
      .replace(/(<li[^>]*>[\s\S]*?<\/li>(\n|$))+/g, (m) => `<ul style="padding-left:18px;margin:6px 0">${m}</ul>`)
      .replace(/\n\n/g, '</p><p style="margin:0 0 8px;color:#555;font-size:14px;line-height:22px">')
      .replace(/\n/g, '<br/>');

    // 步骤4：还原图片和表格占位符
    rawImages.forEach((img, i) => { html = html.replace(`%%IMG${i}%%`, img); });
    rawTables.forEach((tbl, i) => { html = html.replace(`%%TABLE${i}%%`, tbl); });

    return (
      <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, marginTop: 4 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: '#1A1A1A', marginBottom: 10 }}>README</Text>
        {/* @ts-ignore web only */}
        <div
          style={{ fontSize: 14, lineHeight: '22px', color: '#555', fontFamily: 'system-ui,sans-serif', wordBreak: 'break-word' }}
          dangerouslySetInnerHTML={{ __html: `<p style="margin:0 0 8px;color:#555;font-size:14px;line-height:22px">${html}</p>` }}
        />
      </View>
    );
  }

  // ── Native 平台：react-native-marked v8，自定义 Renderer 解决 SVG 徽章问题 ──
  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, marginTop: 4 }}>
      <Text style={{ fontSize: 15, fontWeight: '700', color: '#1A1A1A', marginBottom: 10 }}>README</Text>
      <Marked
        value={cleaned}
        baseUrl={baseUrl}
        renderer={new AppRenderer()}
        flatListProps={{ scrollEnabled: false }}
        styles={{
          text: { fontSize: 14, color: '#555', lineHeight: 22 },
          h1: { fontSize: 18, fontWeight: '700', color: '#1A1A1A', marginBottom: 8, marginTop: 16 },
          h2: { fontSize: 16, fontWeight: '700', color: '#1A1A1A', marginBottom: 6, marginTop: 14 },
          h3: { fontSize: 14, fontWeight: '700', color: '#1A1A1A', marginBottom: 4, marginTop: 12 },
          code: { backgroundColor: '#F4F4F4', borderRadius: 4 },
          blockquote: { borderLeftWidth: 3, borderLeftColor: '#DDD', paddingLeft: 12, marginLeft: 0 },
          link: { color: '#1677FF' },
          hr: { backgroundColor: '#E5E7EB', height: 1, marginVertical: 12 },
          table: { borderWidth: 1, borderColor: '#E5E7EB' },
          tableRow: { borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
          tableCell: { padding: 6 },
          image: { maxWidth: (width - 64) as unknown as undefined },
        }}
      />
    </View>
  );
}

export default function DetailScreen() {
  const { owner, repo } = useLocalSearchParams<{ owner: string; repo: string }>();
  const router = useRouter();
  const { enqueue, findByUrl } = useDownload();
  // 直接打开详情页时导航栈为空，canGoBack() 为 false → 回首页而非 back()
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };
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
        // Record view event
        addAppEvent({ event_type: 'view', app_id: detail.id, app_name: detail.name, owner: owner ?? '', repo: repo ?? '', avatar_url: detail.avatar_url ?? '' }).catch(() => {});
        const installRels = rels.map((r) => ({
          ...r,
          assets: filterInstallAssets(r.assets),
          verification_assets: filterVerificationAssets(r.assets),
        })).filter((r) => r.assets.length > 0);
        setReleases(installRels);
        if (installRels.length > 0) setExpandedRelease(installRels[0].id);
        setReadme(md); // 不限制字数，完整渲染 README
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
    if (favored) {
      await removeFavorite(app.id); setFavored(false);
      addAppEvent({ event_type: 'favorite', app_id: app.id, app_name: app.name, owner: owner ?? '', repo: repo ?? '', avatar_url: app.avatar_url ?? '' }).catch(() => {});
    } else {
      await addFavorite(app); setFavored(true);
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
                              onPress={async () => {
                                if (!app) return;
                                // 检查是否已在下载队列
                                const existing = findByUrl(asset.browser_download_url);
                                if (existing && (existing.status === 'downloading' || existing.status === 'pending')) {
                                  router.push('/downloads' as any);
                                  return;
                                }
                                // 加入 App 内下载队列（不跳浏览器）
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
            { icon: 'git-branch-outline' as const, color: '#FA8C16', label: '最新版本', value: releases[0]?.tag_name || '-' },
            { icon: 'calendar-outline' as const, color: '#722ED1', label: '发布时间', value: releases[0]?.published_at ? releases[0].published_at.slice(0, 10).replace(/-/g, '/') : '-' },
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
        {readme ? <MarkdownSection content={readme} owner={owner ?? ''} repo={repo ?? ''} /> : null}
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

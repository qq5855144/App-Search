import React, { useCallback, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, Linking, Platform, Switch } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAndroidExitBack } from '@/hooks/useAndroidExitBack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { saveToken, getToken, clearToken } from '@/lib/token';
import {
  getFavoriteStats,
  getDownloadHistory,
  clearDownloadHistory,
} from '@/lib/database';
import { fetchReleases, fetchRateLimit, filterInstallAssets } from '@/lib/github';
import { clearAllCache } from '@/lib/cache';
import { getEventCounts } from '@/lib/events';
import { useDownload } from '@/ctx/DownloadContext';
import { getAllTasks, clearAllTasks } from '@/lib/downloadManager';
import { useTranslation, type TargetLang } from '@/ctx/TranslationContext';
import { clearTranslationCache } from '@/lib/translateApi';

type ConfirmTarget = 'downloads' | 'token' | 'cache' | null;

// ── 分隔线 ──────────────────────────────────────────────
const Divider = () => (
  <View style={{ height: 0.5, backgroundColor: '#F0F0F0', marginHorizontal: 16 }} />
);

// ── 区块标题 ─────────────────────────────────────────────
const SectionTitle = ({ title }: { title: string }) => (
  <Text style={{ fontSize: 12, fontWeight: '600', color: '#999', letterSpacing: 0.5,
    marginHorizontal: 16, marginBottom: 6, marginTop: 20 }}>
    {title}
  </Text>
);

// ── 通用列表行 ────────────────────────────────────────────
function Row({
  icon, iconColor, label, value, onPress, danger, trailingIcon,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  trailingIcon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      cssInterop={false}
      style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, backgroundColor: '#fff' }}
      android_ripple={{ color: '#F5F5F5' }}
    >
      <View style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: `${iconColor}15`,
        alignItems: 'center', justifyContent: 'center', marginRight: 13 }}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <Text style={{ flex: 1, fontSize: 15, color: danger ? '#f5222d' : '#1A1A1A' }}>{label}</Text>
      {value !== undefined && (
        <Text style={{ fontSize: 13, color: '#999', marginRight: 6 }}>{value}</Text>
      )}
      {onPress && (
        <Ionicons name={trailingIcon ?? 'chevron-forward'} size={15} color="#D0D0D0" />
      )}
    </Pressable>
  );
}

// ── 统计徽章（我的内容区） ───────────────────────────────
function StatBadge({
  icon, iconColor, label, value, onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      cssInterop={false}
      android_ripple={{ color: '#F5F5F5', borderless: false }}
      style={{ flex: 1, alignItems: 'center', paddingVertical: 16, gap: 6 }}
    >
      <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: `${iconColor}12`,
        alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={22} color={iconColor} />
      </View>
      <Text style={{ fontSize: 18, fontWeight: '700', color: '#1A1A1A' }}>{value}</Text>
      <Text style={{ fontSize: 12, color: '#999' }}>{label}</Text>
    </Pressable>
  );
}

// ── 折叠区块头 ────────────────────────────────────────────
function CollapseHeader({
  icon, iconColor, title, badge, expanded, onToggle,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  badge?: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      onPress={onToggle}
      android_ripple={{ color: '#F5F5F5' }}
      style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 10 }}
    >
      <View style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: `${iconColor}15`,
        alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: '#1A1A1A' }}>{title}</Text>
      {badge}
      <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={15} color="#C0C0C0" />
    </Pressable>
  );
}

// ════════════════════════════════════════════════════════
export default function ProfileTab() {
  useAndroidExitBack();

  const router = useRouter();
  const { activeCount, enqueue } = useDownload();
  const { enabled: translateEnabled, targetLang, setEnabled: setTranslateEnabled, setTargetLang } = useTranslation();

  const [token, setTokenState] = useState('');
  const [githubExpanded, setGithubExpanded] = useState(false);
  const [translateExpanded, setTranslateExpanded] = useState(false);
  const [dataExpanded, setDataExpanded] = useState(false);
  const [aboutExpanded, setAboutExpanded] = useState(false);
  // nativeApplicationVersion = app.json version（如 "1.0.297"，由 CI 写入，运行时固定）
  // nativeBuildVersion = versionCode（如 "297"，与 CI run_number 一致）
  const appVersion = Constants.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '1.0.0';
  type UpdateCheckState = 'idle' | 'checking' | 'latest' | 'update_available' | 'error';
  const [updateCheck, setUpdateCheck] = useState<UpdateCheckState>('idle');
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [updateAssets, setUpdateAssets] = useState<{ name: string; url: string; size: number }[]>([]);

  /**
   * 检测更新核心逻辑（最终方案）：
   * 直接从 release asset 文件名提取版本号，与本地 nativeApplicationVersion 对比
   *
   * APK 命名规则（CI 保证）：openappstore.{version}.apk，如 openappstore.1.0.475.apk
   * - 只有发布新 APK 时文件名才变化，代码 push 触发的新构建不影响判断
   * - 不依赖 Actions run_number（run_number 随每次代码 push 递增，导致误报）
   * - 不依赖 AsyncStorage（首次安装也能正确判断）
   */
  const checkAppUpdate = async () => {
    setUpdateCheck('checking');
    setLatestVersion(null);
    setUpdateAssets([]);
    try {
      const releases = await fetchReleases('qq5855144', 'App-Search', 1, true);
      if (!releases.length) { setUpdateCheck('error'); return; }
      const release = releases[0];
      const installable = filterInstallAssets(release.assets);

      setUpdateAssets(installable.map((a) => ({
        name: a.name,
        url: a.browser_download_url,
        size: a.size,
      })));

      // 从 APK 文件名提取版本号：openappstore.1.0.475.apk → "1.0.475"
      // 兼容旧命名（openappstore-YYYYMMDD-SHA.apk）和无资产情况
      let releaseVersion: string | null = null;
      for (const a of installable) {
        // 新格式：openappstore.{semver}.apk
        const m = a.name.match(/openappstore\.(\d+\.\d+\.\d+)\.apk/i);
        if (m) { releaseVersion = m[1]; break; }
      }

      // 本地已安装版本（运行时固定，由 CI 写入 app.json）
      const localVer = Constants.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '1.0.0';

      if (releaseVersion) {
        setLatestVersion(releaseVersion);
        // 比较 patch 号（版本格式固定为 1.0.N）
        const localN = parseInt(localVer.split('.').pop() ?? '0', 10);
        const remoteN = parseInt(releaseVersion.split('.').pop() ?? '0', 10);
        setUpdateCheck(localN >= remoteN ? 'latest' : 'update_available');
      } else {
        // 无法从文件名提取版本：fallback 显示发布日期
        const displayTag = release.tag_name !== 'latest'
          ? release.tag_name.replace(/^v/i, '')
          : (release.published_at?.slice(0, 10).replace(/-/g, '/') ?? 'latest');
        setLatestVersion(displayTag);
        // 保守判断：有可安装包且本地版本无法比对时提示更新
        setUpdateCheck(installable.length > 0 ? 'update_available' : 'latest');
      }
    } catch {
      setUpdateCheck('error');
    }
  };

  const downloadUpdate = async (asset: { name: string; url: string; size: number }) => {
    await enqueue({
      url: asset.url,
      filename: asset.name,
      appId: 0,
      appName: `开源应用商店 v${latestVersion ?? ''}`,
      owner: 'qq5855144',
      repo: 'App-Search',
      avatarUrl: '',
      version: latestVersion ?? '',
    });
    router.push('/downloads' as any);
  };
  const tokenInputRef = useRef<TextInput>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget>(null);

  const [favCount, setFavCount] = useState(0);
  const [dlCount, setDlCount] = useState(0);
  const [rateLimit, setRateLimit] = useState({ remaining: 60, limit: 60, reset: 0 });
  const [cacheSize, setCacheSize] = useState(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [t, stats, dl, evCounts] = await Promise.all([
        getToken(),
        getFavoriteStats(),
        getDownloadHistory(),
        getEventCounts(),
      ]);
      if (t) { setTokenState(t); setSaved(true); }
      setFavCount(stats.total);
      const activeTasks = getAllTasks();
      // 仅统计本地当前已完成/进行中的任务数，不累计历史总数
      const completedCount = activeTasks.filter(t => t.status === 'completed').length;
      const activeDlCount = activeTasks.filter(
        t => t.status === 'downloading' || t.status === 'pending'
      ).length;
      setDlCount(completedCount + activeDlCount);
      fetchRateLimit().then(setRateLimit).catch(() => {});
      try {
        if (typeof localStorage !== 'undefined') {
          let totalBytes = 0;
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i) ?? '';
            if (k.startsWith('oas_cache:')) totalBytes += (localStorage.getItem(k) ?? '').length * 2;
          }
          setCacheSize(Math.round(totalBytes / 1024));
        }
      } catch { /* non-web */ }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const handleSave = async () => {
    const t = token.trim();
    if (t.length < 10 || saving) return;
    setSaving(true);
    try {
      await saveToken(t);
      setSaved(true);
      fetchRateLimit().then(setRateLimit).catch(() => {});
    } catch { /* ignore */ } finally { setSaving(false); }
  };

  const handleConfirm = async () => {
    const target = confirmTarget;
    setConfirmTarget(null);
    if (target === 'downloads') {
      // 仅清除本地 SQLite 下载记录 + 内存任务，不删除已下载文件
      await clearDownloadHistory();
      clearAllTasks();
      setDlCount(0);
    } else if (target === 'token') {
      await clearToken(); setTokenState(''); setSaved(false);
      setRateLimit({ remaining: 60, limit: 60, reset: 0 });
    } else if (target === 'cache') { await clearAllCache(); setCacheSize(0); }
  };

  const ratePct = rateLimit.limit > 0 ? rateLimit.remaining / rateLimit.limit : 0;
  const rateColor = ratePct > 0.5 ? '#52c41a' : ratePct > 0.2 ? '#faad14' : '#f5222d';
  const resetTime = rateLimit.reset
    ? new Date(rateLimit.reset * 1000).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    : '--:--';

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F6F8', alignItems: 'center', justifyContent: 'center' }} edges={['top']}>
        <ActivityIndicator color="#1677FF" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F6F8' }} edges={['top']}>

      {/* ── 确认弹窗 ── */}
      {confirmTarget && (
        <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)',
          zIndex: 100, alignItems: 'center', justifyContent: 'center' } as any}>
          <View style={{ backgroundColor: '#fff', borderRadius: 18, padding: 24, width: 288, gap: 14 }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: '#1A1A1A', textAlign: 'center' }}>
              {confirmTarget === 'token' ? '清除 Token' : '确认清空'}
            </Text>
            <Text style={{ fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 20 }}>
              {confirmTarget === 'downloads'
                ? '仅清除本机下载记录和队列任务（不删除已下载文件），此操作不可撤销'
                : confirmTarget === 'cache'
                ? '将清除所有本地缓存，下次打开会重新请求数据'
                : '将删除已保存的 GitHub Token，API 限额恢复 60 次/小时'}
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable onPress={() => setConfirmTarget(null)}
                style={{ flex: 1, height: 44, borderRadius: 10, borderWidth: 1,
                  borderColor: '#E0E0E0', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#666', fontWeight: '500' }}>取消</Text>
              </Pressable>
              <Pressable onPress={handleConfirm}
                style={{ flex: 1, height: 44, borderRadius: 10,
                  backgroundColor: '#f5222d', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#fff', fontWeight: '600' }}>确认</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      <ScrollView contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>

        {/* ── 页面标题 ── */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 }}>
          <Text style={{ fontSize: 24, fontWeight: '800', color: '#1A1A1A', letterSpacing: -0.3 }}>我的</Text>
        </View>

        {/* ════ 一、我的内容（收藏 + 下载 统计卡片） ════ */}
        <SectionTitle title="我的内容" />
        <View style={{ marginHorizontal: 16, backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', marginBottom: 4 }}>
          <View style={{ flexDirection: 'row' }}>
            <StatBadge
              icon="heart" iconColor="#FF4D88"
              label="收藏"
              value={String(favCount)}
              onPress={() => router.push('/favorites' as any)}
            />
            <View style={{ width: 0.5, backgroundColor: '#F0F0F0', marginVertical: 12 }} />
            <StatBadge
              icon="download" iconColor="#1677FF"
              label={activeCount > 0 ? `下载管理 · ${activeCount}进行中` : '下载管理'}
              value={String(dlCount)}
              onPress={() => router.push('/downloads' as any)}
            />
          </View>
        </View>

        {/* ════ 二、GitHub 连接（Token + API 配额合并折叠） ════ */}
        <SectionTitle title="GitHub 连接" />
        <View style={{ marginHorizontal: 16, backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', marginBottom: 4 }}>
          <CollapseHeader
            icon="logo-github" iconColor="#1A1A1A"
            title="GitHub 账号配置"
            badge={saved
              ? <View style={{ backgroundColor: '#F6FFED', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2,
                  borderWidth: 1, borderColor: '#B7EB8F' }}>
                  <Text style={{ fontSize: 11, color: '#52C41A' }}>已连接</Text>
                </View>
              : undefined}
            expanded={githubExpanded}
            onToggle={() => setGithubExpanded((v) => !v)}
          />

          {githubExpanded && (
            <View style={{ borderTopWidth: 0.5, borderTopColor: '#F0F0F0' }}>
              {/* API 配额状态行 */}
              <Pressable
                onPress={() => Linking.openURL('https://docs.github.com/en/rest/overview/rate-limits-for-the-rest-api')}
                cssInterop={false}
                android_ripple={{ color: '#F5F5F5' }}
                style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 10 }}
              >
                <Ionicons name="flash-outline" size={16} color={rateColor} />
                <Text style={{ flex: 1, fontSize: 14, color: '#555' }}>API 配额</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 80, height: 4, borderRadius: 2, backgroundColor: '#F0F0F0', overflow: 'hidden' }}>
                    <View style={{ width: `${ratePct * 100}%`, height: '100%', backgroundColor: rateColor, borderRadius: 2 }} />
                  </View>
                  <Text style={{ fontSize: 12, color: '#999' }}>
                    {rateLimit.remaining}/{rateLimit.limit}
                  </Text>
                </View>
                <Text style={{ fontSize: 11, color: '#CCC', marginLeft: 2 }}>重置 {resetTime}</Text>
              </Pressable>

              <Divider />

              {/* Token 输入区（直接展示，不再二次折叠） */}
              <View style={{ paddingHorizontal: 16, paddingBottom: 16, paddingTop: 10 }}>
                <Text style={{ fontSize: 12, color: '#999', marginBottom: 10 }}>
                  配置 Personal Access Token 可将 API 限额提升至 5000 次/小时
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F7F7F7',
                  borderRadius: 10, paddingHorizontal: 12, height: 44, marginBottom: 10 }}>
                  <TextInput
                    ref={tokenInputRef}
                    style={{ flex: 1, fontSize: 14, color: '#1A1A1A' } as any}
                    value={token}
                    onChangeText={setTokenState}
                    placeholder="github_pat_..."
                    placeholderTextColor="#C0C0C0"
                    secureTextEntry={false}
                    textContentType="none"
                    autoComplete="off"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable
                    onPress={handleSave}
                    disabled={token.trim().length < 10 || saving}
                    style={{ flex: 1, height: 40, borderRadius: 10,
                      backgroundColor: token.trim().length >= 10 ? '#1677FF' : '#E8E8E8',
                      alignItems: 'center', justifyContent: 'center' }}
                  >
                    {saving
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>保存</Text>}
                  </Pressable>
                  <Pressable
                    onPress={() => Linking.openURL('https://github.com/settings/tokens/new')}
                    style={{ height: 40, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1,
                      borderColor: '#D8D8D8', alignItems: 'center', justifyContent: 'center',
                      flexDirection: 'row', gap: 4 }}
                  >
                    <Ionicons name="open-outline" size={13} color="#555" />
                    <Text style={{ color: '#555', fontSize: 13 }}>创建</Text>
                  </Pressable>
                  {saved && (
                    <Pressable
                      onPress={() => setConfirmTarget('token')}
                      style={{ height: 40, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1,
                        borderColor: '#FFB3B3', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Text style={{ color: '#f5222d', fontSize: 13 }}>清除</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            </View>
          )}
        </View>

        {/* ════ 三、翻译服务（列表折叠，语言行各含互斥开关） ════ */}
        <SectionTitle title="翻译服务" />
        <View style={{ marginHorizontal: 16, backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', marginBottom: 4 }}>
          <CollapseHeader
            icon="language-outline" iconColor="#1677FF"
            title="自动翻译"
            badge={
              <Text style={{ fontSize: 12, color: translateEnabled ? '#1677FF' : '#BBB' }}>
                {translateEnabled ? (targetLang === 'zh' ? '译为中文' : '译为英文') : '已关闭'}
              </Text>
            }
            expanded={translateExpanded}
            onToggle={() => setTranslateExpanded((v) => !v)}
          />

          {translateExpanded && (
            <View style={{ borderTopWidth: 0.5, borderTopColor: '#F0F0F0' }}>
              {/* 译为中文行 */}
              <View
                style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
                  paddingVertical: 13, backgroundColor: '#fff' }}
              >
                <View style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: '#1677FF15',
                  alignItems: 'center', justifyContent: 'center', marginRight: 13 }}>
                  <Text style={{ fontSize: 17 }}>🇨🇳</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, color: '#1A1A1A' }}>译为中文</Text>
                  <Text style={{ fontSize: 12, color: '#999', marginTop: 1 }}>翻译所有非中文内容</Text>
                </View>
                <Switch
                  value={translateEnabled && targetLang === 'zh'}
                  onValueChange={(v) => {
                    if (v) { setTranslateEnabled(true); setTargetLang('zh'); }
                    else { setTranslateEnabled(false); }
                  }}
                  trackColor={{ false: '#E0E0E0', true: '#1677FF' }}
                  thumbColor="#fff"
                />
              </View>

              <Divider />

              {/* 译为英文行 */}
              <View
                style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
                  paddingVertical: 13, backgroundColor: '#fff' }}
              >
                <View style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: '#1677FF15',
                  alignItems: 'center', justifyContent: 'center', marginRight: 13 }}>
                  <Text style={{ fontSize: 17 }}>🇺🇸</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, color: '#1A1A1A' }}>译为英文</Text>
                  <Text style={{ fontSize: 12, color: '#999', marginTop: 1 }}>翻译所有非英文内容</Text>
                </View>
                <Switch
                  value={translateEnabled && targetLang === 'en'}
                  onValueChange={(v) => {
                    if (v) { setTranslateEnabled(true); setTargetLang('en'); }
                    else { setTranslateEnabled(false); }
                  }}
                  trackColor={{ false: '#E0E0E0', true: '#1677FF' }}
                  thumbColor="#fff"
                />
              </View>

              <Divider />

              {/* 清除翻译缓存 */}
              <Row
                icon="refresh-outline" iconColor="#FA8C16"
                label="清除翻译缓存"
                onPress={async () => { await clearTranslationCache(); }}
              />
            </View>
          )}
        </View>

        {/* ════ 四、数据管理 ════ */}
        <SectionTitle title="数据管理" />
        <View style={{ marginHorizontal: 16, backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', marginBottom: 4 }}>
          <CollapseHeader
            icon="server-outline" iconColor="#FF8C00"
            title="本地数据"
            badge={
              <Text style={{ fontSize: 12, color: '#BBB' }}>
                {cacheSize > 0 ? `缓存 ${cacheSize} KB` : '已清空'}
              </Text>
            }
            expanded={dataExpanded}
            onToggle={() => setDataExpanded((v) => !v)}
          />
          {dataExpanded && (
            <View style={{ borderTopWidth: 0.5, borderTopColor: '#F0F0F0' }}>
              <Row
                icon="folder-outline" iconColor="#FF8C00"
                label="清除本地缓存"
                value={cacheSize > 0 ? `${cacheSize} KB` : '已清空'}
                onPress={() => setConfirmTarget('cache')}
                trailingIcon="trash-outline"
              />
              <Divider />
              <Row
                icon="trash-outline" iconColor="#f5222d"
                label="清除下载记录"
                value={dlCount > 0 ? `本地 ${dlCount} 条` : '暂无记录'}
                onPress={dlCount > 0 ? () => setConfirmTarget('downloads') : undefined}
                danger={dlCount > 0}
                trailingIcon="trash-outline"
              />
              {/* 说明文字 */}
              <View style={{ paddingHorizontal: 16, paddingBottom: 12, paddingTop: 4 }}>
                <Text style={{ fontSize: 11, color: '#BBB', lineHeight: 16 }}>
                  以上操作仅清除本机本地数据，不影响已下载到 Downloads 目录的文件
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* ════ 五、关于（折叠） ════ */}
        <SectionTitle title="关于" />
        <View style={{ marginHorizontal: 16, backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', marginBottom: 4 }}>
          <CollapseHeader
            icon="information-circle-outline" iconColor="#1677FF"
            title="关于应用"
            badge={<Text style={{ fontSize: 12, color: '#CCC' }}>v{appVersion}</Text>}
            expanded={aboutExpanded}
            onToggle={() => setAboutExpanded((v) => !v)}
          />
          {aboutExpanded && (
            <View style={{ borderTopWidth: 0.5, borderTopColor: '#F0F0F0' }}>
              {([
                { label: '应用版本', value: appVersion, onPress: undefined },
                { label: '数据来源', value: 'GitHub API', onPress: undefined },
                { label: '运行平台', value: Platform.OS, onPress: undefined },
                { label: '项目仓库', value: 'GitHub', onPress: () => Linking.openURL('https://github.com/qq5855144/App-Search') },
              ] as const).map((item, i, arr) => (
                <React.Fragment key={item.label}>
                  <Pressable
                    onPress={item.onPress}
                    disabled={!item.onPress}
                    android_ripple={{ color: '#F5F5F5' }}
                    style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                      paddingHorizontal: 16, paddingVertical: 13 }}
                  >
                    <Text style={{ color: '#666', fontSize: 14 }}>{item.label}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text style={{ color: '#1A1A1A', fontSize: 14, fontWeight: '500' }}>{item.value}</Text>
                      {item.onPress && <Ionicons name="open-outline" size={13} color="#BBB" />}
                    </View>
                  </Pressable>
                  {i < arr.length - 1 && <Divider />}
                </React.Fragment>
              ))}
              {/* 检测更新行 */}
              <Divider />
              <Pressable
                onPress={updateCheck !== 'checking' ? checkAppUpdate : undefined}
                android_ripple={{ color: '#F5F5F5' }}
                style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                  paddingHorizontal: 16, paddingVertical: 13 }}
              >
                <Text style={{ color: '#666', fontSize: 14 }}>检测更新</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {updateCheck === 'checking' && <ActivityIndicator size={14} color="#1677FF" />}
                  {updateCheck === 'latest' && (
                    <Text style={{ fontSize: 13, color: '#52C41A', fontWeight: '500' }}>已是最新版本</Text>
                  )}
                  {updateCheck === 'update_available' && (
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Text style={{ fontSize: 12, color: '#FA8C16', fontWeight: '600' }}>
                        发现新版 v{latestVersion}
                      </Text>
                      {updateAssets.length > 0 ? (
                        updateAssets.map((a) => (
                          <Pressable key={a.url} onPress={() => downloadUpdate(a)}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 4,
                              backgroundColor: '#FA8C16', borderRadius: 8,
                              paddingHorizontal: 10, paddingVertical: 4 }}>
                            <Ionicons name="arrow-down-circle-outline" size={14} color="#fff" />
                            <Text style={{ fontSize: 12, color: '#fff', fontWeight: '600' }}>
                              {a.name.length > 20 ? a.name.slice(0, 18) + '…' : a.name}
                            </Text>
                          </Pressable>
                        ))
                      ) : (
                        <Pressable onPress={() => Linking.openURL('https://github.com/qq5855144/App-Search/releases/latest')}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 4,
                            backgroundColor: '#FFF7E6', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                          <Text style={{ fontSize: 12, color: '#FA8C16' }}>前往查看</Text>
                          <Ionicons name="open-outline" size={12} color="#FA8C16" />
                        </Pressable>
                      )}
                    </View>
                  )}
                  {updateCheck === 'error' && (
                    <Text style={{ fontSize: 13, color: '#FF4D4F' }}>检测失败，点击重试</Text>
                  )}
                  {updateCheck === 'idle' && (
                    <Text style={{ fontSize: 13, color: '#BBB' }}>点击检测</Text>
                  )}
                  {updateCheck !== 'checking' && <Ionicons name="chevron-forward" size={14} color="#DDD" />}
                </View>
              </Pressable>
            </View>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}


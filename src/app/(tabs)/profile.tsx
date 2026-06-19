import React, { useCallback, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, Linking, Platform } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { saveToken, getToken, clearToken } from '@/lib/token';
import {
  getFavoriteStats,
  getDownloadHistory,
  clearDownloadHistory,
} from '@/lib/database';
import { fetchRateLimit } from '@/lib/github';
import { clearAllCache } from '@/lib/cache';
import { getEventCounts } from '@/lib/events';
import { useDownload } from '@/ctx/DownloadContext';
import { getAllTasks, clearAllTasks } from '@/lib/downloadManager';

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
  const router = useRouter();
  const { activeCount } = useDownload();

  const [token, setTokenState] = useState('');
  const [githubExpanded, setGithubExpanded] = useState(false);
  const [dataExpanded, setDataExpanded] = useState(false);
  const [aboutExpanded, setAboutExpanded] = useState(false);
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

        {/* ════ 三、数据管理（缓存 + 下载记录，同属清理操作） ════ */}
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

        {/* ════ 四、关于（折叠） ════ */}
        <SectionTitle title="关于" />
        <View style={{ marginHorizontal: 16, backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', marginBottom: 4 }}>
          <CollapseHeader
            icon="information-circle-outline" iconColor="#1677FF"
            title="关于应用"
            badge={<Text style={{ fontSize: 12, color: '#CCC' }}>v1.0.0</Text>}
            expanded={aboutExpanded}
            onToggle={() => setAboutExpanded((v) => !v)}
          />
          {aboutExpanded && (
            <View style={{ borderTopWidth: 0.5, borderTopColor: '#F0F0F0' }}>
              {([
                { label: '应用版本', value: '1.0.0', onPress: undefined },
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
            </View>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}


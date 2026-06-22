/**
 * 下载管理页面 v2
 *
 * 功能：
 * - 进行中：进度环 + 进度条、速度/ETA、暂停（仅 iOS）/恢复/取消/重试
 * - 已完成：文件大小、安装/打开/删除
 * - 已安装：检查更新/忽略/移除记录
 * - 通知权限提示条
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, Platform, AppState } from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useAndroidGoBack } from '@/hooks/useAndroidGoBack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { useDownload } from '@/ctx/DownloadContext';
import { useUpdate } from '@/ctx/UpdateContext';
import { formatSpeed, formatBytes, isInstallerFile, getMimeType } from '@/lib/downloadManager';
import { normalizeVersion } from '@/lib/github';
import {
  getInstalledApps, ignoreInstalledUpdate, removeInstalledApp,
  type InstalledApp,
} from '@/lib/database';
import { getNotificationPermissionStatus, requestNotificationPermission } from '@/lib/notifications';
import type { DownloadTask } from '@/lib/downloadManager';

const BLUE = '#1677FF';
const GREEN = '#52C41A';
const RED = '#FF4D4F';
const ORANGE = '#FA8C16';
const RADIUS = 17;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

type TabKey = 'active' | 'done' | 'installed';

// ── 进度环 ────────────────────────────────────────────────
function ProgressCircle({ progress, status }: { progress: number; status: string }) {
  const isIndeterminate = progress < 0 && status === 'downloading';
  const offset = isIndeterminate ? 0 : CIRCUMFERENCE * (1 - Math.min(progress, 1));
  const color = status === 'failed' ? RED : status === 'completed' ? GREEN : BLUE;
  return (
    <View style={{ width: 44, height: 44 }}>
      {isIndeterminate ? (
        <ActivityIndicator size={44} color={BLUE} />
      ) : (
        <Svg width={44} height={44} viewBox="0 0 44 44">
          <Circle cx={22} cy={22} r={RADIUS} stroke="#EBEBEB" strokeWidth={3} fill="none" />
          {progress > 0 && (
            <Circle
              cx={22} cy={22} r={RADIUS} stroke={color} strokeWidth={3} fill="none"
              strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`} strokeDashoffset={offset}
              strokeLinecap="round" rotation={-90} origin="22,22"
            />
          )}
        </Svg>
      )}
      {!isIndeterminate && (
        <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons
            name={status === 'completed' ? 'checkmark' : status === 'failed' ? 'close' :
              status === 'paused' ? 'pause' : 'arrow-down'}
            size={15} color={color}
          />
        </View>
      )}
    </View>
  );
}

// ── 细进度条 ──────────────────────────────────────────────
function ProgressBar({ progress }: { progress: number }) {
  if (progress <= 0) return null;
  const pct = Math.min(progress, 1) * 100;
  return (
    <View style={{ height: 3, backgroundColor: '#EBEBEB', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
      <View style={{ width: `${pct}%`, height: '100%', backgroundColor: BLUE, borderRadius: 2 }} />
    </View>
  );
}

// ── 标签页按钮 ────────────────────────────────────────────
function TabBtn({ label, active, badge, onPress }: {
  label: string; active: boolean; badge?: number; onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={{ flex: 1, alignItems: 'center', paddingVertical: 10, gap: 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Text style={{ fontSize: 14, fontWeight: active ? '700' : '400', color: active ? BLUE : '#888' }}>
          {label}
        </Text>
        {badge != null && badge > 0 && (
          <View style={{ minWidth: 18, height: 18, borderRadius: 9,
            backgroundColor: active ? BLUE : '#CCC', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
            <Text style={{ fontSize: 11, color: '#fff', fontWeight: '700' }}>{badge > 99 ? '99+' : badge}</Text>
          </View>
        )}
      </View>
      {active && <View style={{ width: 24, height: 2, borderRadius: 1, backgroundColor: BLUE }} />}
    </Pressable>
  );
}

// ── 操作按钮 ─────────────────────────────────────────────
function ActionBtn({ icon, color, bg, onPress, label }: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string; bg: string; onPress: () => void; label?: string;
}) {
  if (label) {
    return (
      <Pressable onPress={onPress}
        style={{ paddingHorizontal: 12, height: 34, borderRadius: 17, backgroundColor: bg,
          alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color }}>{label}</Text>
      </Pressable>
    );
  }
  return (
    <Pressable onPress={onPress}
      style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: bg,
        alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon} size={17} color={color} />
    </Pressable>
  );
}

export default function DownloadsScreen() {
  useAndroidGoBack();

  const router = useRouter();
  const { tab: initTab } = useLocalSearchParams<{ tab?: string }>();
  const { tasks, pause, resume, cancel, deleteFile, clearFinished, pauseAll, resumeAll, retry } = useDownload();
  const { pendingCount, checking, refresh: refreshUpdateCount } = useUpdate();

  const [tab, setTab] = useState<TabKey>(() =>
    initTab === 'installed' || initTab === 'done' || initTab === 'active' ? initTab : 'active',
  );
  const [installed, setInstalled] = useState<InstalledApp[]>([]);
  const [installedLoading, setInstalledLoading] = useState(false);
  const [notifStatus, setNotifStatus] = useState<'granted' | 'denied' | 'undetermined' | 'unavailable'>('undetermined');
  const [confirmClear, setConfirmClear] = useState(false);
  const [installingId, setInstallingId] = useState<string | null>(null);

  const activeTasks = tasks.filter(
    (t) => t.status === 'pending' || t.status === 'downloading' || t.status === 'paused',
  );
  const doneTasks = tasks.filter(
    (t) => t.status === 'completed' || t.status === 'failed' || t.status === 'cancelled',
  );
  const allPaused = activeTasks.length > 0 && activeTasks.every((t) => t.status === 'paused');

  const updatableApps = installed.filter((a) => {
    if (!a.latest_version) return false;
    if (a.latest_version === a.installed_version) return false;
    if (a.ignored_version && a.latest_version === a.ignored_version) return false;
    return true;
  });

  const loadInstalled = useCallback(async () => {
    setInstalledLoading(true);
    try {
      const list = await getInstalledApps();
      setInstalled(list);
    } catch { /* ignore */ } finally {
      setInstalledLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    (async () => {
      if (Platform.OS !== 'web') {
        const s = await getNotificationPermissionStatus();
        setNotifStatus(s);
      }
      if (tab === 'installed') loadInstalled();
    })();
  }, [tab]));

  useEffect(() => {
    if (tab === 'installed') loadInstalled();
  }, [tab]);

  // 有进行中任务时自动留在 active，否则跳 done
  useEffect(() => {
    if (tab === 'active' && activeTasks.length === 0 && doneTasks.length > 0) setTab('done');
  }, [tasks.length]);

  // ── 安装 APK ───────────────────────────────────────────
  const handleInstall = async (item: DownloadTask) => {
    if (!item.localUri || installingId) return;
    setInstallingId(item.id);
    try {
      if (Platform.OS === 'android') {
        const IL = await import('expo-intent-launcher');
        const FS = await import('expo-file-system/legacy');
        // file:// → content:// via FileProvider（Android 7+ 跨进程必须用 content://）
        const contentUri = await FS.getContentUriAsync(item.localUri);
        await IL.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          type: getMimeType(item.filename),
          flags: 1,
        });
      } else {
        const Sharing = await import('expo-sharing');
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(item.localUri, {
            mimeType: getMimeType(item.filename),
            dialogTitle: isInstallerFile(item.filename) ? '安装应用' : '查看文件',
          });
        }
      }
    } catch (err) {
      console.warn('[Downloads] 安装失败:', err);
    } finally {
      setInstallingId(null);
    }
  };

  // ── 已安装操作 ─────────────────────────────────────────
  const handleIgnoreUpdate = async (app: InstalledApp) => {
    if (!app.latest_version) return;
    await ignoreInstalledUpdate(app.app_id, app.latest_version);
    await loadInstalled();
    await refreshUpdateCount();
  };

  const handleRemoveInstalled = async (app: InstalledApp) => {
    await removeInstalledApp(app.app_id);
    await loadInstalled();
    await refreshUpdateCount();
  };

  // ── 渲染：进行中任务行 ────────────────────────────────────
  const renderActiveItem = ({ item }: { item: DownloadTask }) => {
    const pct = item.progress >= 0 ? Math.round(item.progress * 100) : null;
    const spd = formatSpeed(item.speed);
    const isDownloading = item.status === 'downloading';
    const isPaused = item.status === 'paused';
    const isFailed = item.status === 'failed';
    // Android 无断点续传，不显示暂停按钮（暂停=取消后重头来，改为只显示取消）
    const canPause = isPaused === false && isDownloading && Platform.OS === 'ios';

    return (
      <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8,
        borderWidth: 0.5, borderColor: '#F0F0F0' }}>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <ProgressCircle progress={item.progress} status={item.status} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ fontWeight: '600', color: '#1A1A1A', fontSize: 15 }} numberOfLines={1}>
              {item.appName}
            </Text>
            <Text style={{ fontSize: 12, color: '#888' }} numberOfLines={1}>{item.filename}</Text>

            {isDownloading && (
              <View style={{ gap: 1 }}>
                {pct != null
                  ? <Text style={{ fontSize: 12, color: BLUE, fontWeight: '600' }}>{pct}%</Text>
                  : <Text style={{ fontSize: 12, color: BLUE, fontWeight: '600' }}>下载中…</Text>}
                {spd ? <Text style={{ fontSize: 11, color: '#999' }}>{spd}</Text> : null}
                {(item.totalBytes > 0 || item.eta > 0) && (
                  <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                    {item.totalBytes > 0 && (
                      <Text style={{ fontSize: 11, color: '#BBB' }}>
                        {formatBytes(item.bytesWritten)}/{formatBytes(item.totalBytes)}
                      </Text>
                    )}
                    {item.eta > 0 && (
                      <Text style={{ fontSize: 11, color: '#BBB' }}>
                        剩余 {item.eta < 60 ? `${item.eta}s` : `${Math.round(item.eta / 60)}min`}
                      </Text>
                    )}
                  </View>
                )}
              </View>
            )}

            {isPaused && (
              <Text style={{ fontSize: 12, color: ORANGE, fontWeight: '500' }}>
                已暂停{pct != null ? ` · ${pct}%` : ''}
              </Text>
            )}
            {item.status === 'pending' && (
              <Text style={{ fontSize: 12, color: '#AAA' }}>队列等待中…</Text>
            )}
            {isFailed && item.error && (
              <Text style={{ fontSize: 11, color: RED }} numberOfLines={2}>{item.error}</Text>
            )}
          </View>

          <View style={{ flexDirection: 'row', gap: 6 }}>
            {canPause && (
              <ActionBtn icon="pause" color={ORANGE} bg="#FFF7E6" onPress={() => pause(item.id)} />
            )}
            {isPaused && (
              <ActionBtn icon="play" color={BLUE} bg="#E6F7FF" onPress={() => resume(item.id)} />
            )}
            {(isDownloading || isPaused || item.status === 'pending') && (
              <ActionBtn icon="close" color={RED} bg="#FFF1F0" onPress={() => cancel(item.id)} />
            )}
            {isFailed && (
              <ActionBtn icon="refresh" color="#fff" bg={RED} label="重试" onPress={() => retry(item.id)} />
            )}
          </View>
        </View>

        {/* 细进度条：只在有明确进度时显示 */}
        {isDownloading && <ProgressBar progress={item.progress} />}
      </View>
    );
  };

  // ── 渲染：已完成任务行 ────────────────────────────────────
  const renderDoneItem = ({ item }: { item: DownloadTask }) => {
    const isInstaller = isInstallerFile(item.filename);
    const statusLabel = item.status === 'failed' ? '失败' : item.status === 'cancelled' ? '已取消' : '完成';
    const statusColor = item.status === 'failed' ? RED : item.status === 'cancelled' ? '#AAA' : GREEN;
    const isInstalling = installingId === item.id;

    return (
      <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8,
        borderWidth: 0.5, borderColor: '#F0F0F0' }}>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <ProgressCircle progress={item.progress} status={item.status} />
          <View style={{ flex: 1, gap: 3 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontWeight: '600', color: '#1A1A1A', fontSize: 15, flex: 1 }} numberOfLines={1}>
                {item.appName}
              </Text>
              <View style={{ backgroundColor: `${statusColor}15`, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                <Text style={{ fontSize: 11, color: statusColor, fontWeight: '600' }}>{statusLabel}</Text>
              </View>
            </View>
            <Text style={{ fontSize: 12, color: '#888' }} numberOfLines={1}>{item.filename}</Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {item.totalBytes > 0 && (
                <Text style={{ fontSize: 11, color: '#AAA' }}>{formatBytes(item.totalBytes)}</Text>
              )}
              <Text style={{ fontSize: 11, color: '#BBB' }}>
                {new Date(item.createdAt).toLocaleDateString('zh-CN')}{' '}
                {new Date(item.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
            {item.status === 'failed' && item.error && (
              <Text style={{ fontSize: 11, color: RED }} numberOfLines={1}>{item.error}</Text>
            )}
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {item.status === 'completed' && item.localUri && (
              isInstalling
                ? <ActivityIndicator size={20} color={GREEN} style={{ width: 34, height: 34 }} />
                : <ActionBtn
                    icon={isInstaller ? 'phone-portrait-outline' : 'open-outline'}
                    color={GREEN} bg="#F6FFED"
                    label={isInstaller ? '安装' : '打开'}
                    onPress={() => handleInstall(item)}
                  />
            )}
            {item.status === 'failed' && (
              <ActionBtn icon="refresh" color={BLUE} bg="#E6F7FF" onPress={() => retry(item.id)} />
            )}
            <ActionBtn icon="trash-outline" color={RED} bg="#FFF1F0" onPress={() => deleteFile(item.id)} />
          </View>
        </View>
      </View>
    );
  };

  // ── 渲染：已安装应用行 ────────────────────────────────────
  const renderInstalledItem = ({ item }: { item: InstalledApp }) => {
    const hasUpdate = item.latest_version
      && normalizeVersion(item.latest_version) !== normalizeVersion(item.installed_version)
      && normalizeVersion(item.latest_version) !== normalizeVersion(item.ignored_version ?? '');

    return (
      <Pressable
        onPress={() => router.push({
          pathname: '/detail/[id]',
          params: { id: String(item.app_id), owner: item.owner, repo: item.repo },
        } as any)}
        style={{ backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8,
          borderWidth: 0.5, borderColor: hasUpdate ? '#FFD591' : '#F0F0F0' }}
      >
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <View style={{ width: 44, height: 44, borderRadius: 12, overflow: 'hidden',
            backgroundColor: '#F5F6F8', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="cube-outline" size={24} color="#AAA" />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ fontWeight: '600', color: '#1A1A1A', fontSize: 15 }} numberOfLines={1}>
              {item.app_name}
            </Text>
            <Text style={{ fontSize: 12, color: '#888' }}>
              {item.owner}/{item.repo}
            </Text>
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <View style={{ backgroundColor: '#F0F5FF', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                <Text style={{ fontSize: 11, color: BLUE, fontWeight: '600' }}>
                  已安装 {item.installed_version}
                </Text>
              </View>
              {hasUpdate && (
                <View style={{ backgroundColor: '#FFF7E6', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                  <Text style={{ fontSize: 11, color: ORANGE, fontWeight: '600' }}>
                    新版 {item.latest_version}
                  </Text>
                </View>
              )}
            </View>
          </View>
          <View style={{ gap: 6, alignItems: 'flex-end' }}>
            {hasUpdate ? (
              <>
                <ActionBtn icon="arrow-up-circle-outline" color="#fff" bg={ORANGE} label="更新"
                  onPress={() => router.push({
                    pathname: '/detail/[id]',
                    params: { id: String(item.app_id), owner: item.owner, repo: item.repo },
                  } as any)}
                />
                <Pressable onPress={() => handleIgnoreUpdate(item)} style={{ paddingVertical: 2 }}>
                  <Text style={{ fontSize: 11, color: '#AAA' }}>忽略此版本</Text>
                </Pressable>
              </>
            ) : (
              <View style={{ backgroundColor: '#F6FFED', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 }}>
                <Text style={{ fontSize: 11, color: GREEN, fontWeight: '600' }}>已是最新</Text>
              </View>
            )}
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10,
          paddingTop: 8, borderTopWidth: 0.5, borderTopColor: '#F5F5F5' }}>
          <Ionicons name="time-outline" size={12} color="#CCC" />
          <Text style={{ fontSize: 11, color: '#CCC', marginLeft: 4, flex: 1 }}>
            安装于 {new Date(item.installed_at).toLocaleDateString('zh-CN')}
            {item.last_checked ? ` · 检查于 ${new Date(item.last_checked).toLocaleDateString('zh-CN')}` : ''}
          </Text>
          <Pressable onPress={() => handleRemoveInstalled(item)} hitSlop={8}>
            <Text style={{ fontSize: 11, color: '#CCC' }}>移除记录</Text>
          </Pressable>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F6F8' }} edges={['top']}>
      {/* 确认清除弹窗 */}
      {confirmClear && (
        <Pressable onPress={() => setConfirmClear(false)}
          style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 100,
            alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 24, width: 280, gap: 16 }}
            onStartShouldSetResponder={() => true}>
            <Text style={{ fontSize: 16, fontWeight: '700', textAlign: 'center' }}>确认清除</Text>
            <Text style={{ fontSize: 14, color: '#555', textAlign: 'center' }}>
              已完成的下载记录将被清除（文件不会被删除）
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable onPress={() => setConfirmClear(false)}
                style={{ flex: 1, borderRadius: 10, borderWidth: 1, borderColor: '#E0E0E0',
                  paddingVertical: 11, alignItems: 'center' }}>
                <Text style={{ color: '#555', fontWeight: '500' }}>取消</Text>
              </Pressable>
              <Pressable
                onPress={() => { clearFinished(); setConfirmClear(false); }}
                style={{ flex: 1, borderRadius: 10, backgroundColor: RED, paddingVertical: 11, alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontWeight: '600' }}>确认清除</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      )}

      {/* ── 头部 ── */}
      <View style={{ backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#EBEBEB' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
          <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)' as any)}
            hitSlop={12} style={{ marginRight: 12 }}>
            <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
          </Pressable>
          <Text style={{ flex: 1, fontSize: 18, fontWeight: '700' }}>下载管理</Text>
          {tab === 'active' && activeTasks.length > 0 && Platform.OS === 'ios' && (
            <Pressable onPress={() => allPaused ? resumeAll() : pauseAll()}
              style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#F0F5FF', marginRight: 6 }}>
              <Text style={{ fontSize: 13, color: BLUE, fontWeight: '500' }}>{allPaused ? '全部恢复' : '全部暂停'}</Text>
            </Pressable>
          )}
          {tab === 'done' && doneTasks.length > 0 && (
            <Pressable onPress={() => setConfirmClear(true)} hitSlop={8}>
              <Text style={{ color: RED, fontSize: 13, fontWeight: '500' }}>清除记录</Text>
            </Pressable>
          )}
          {tab === 'installed' && checking && (
            <ActivityIndicator size={13} color={BLUE} style={{ marginRight: 6 }} />
          )}
        </View>

        {/* ── 标签栏 ── */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 8 }}>
          <TabBtn label="进行中" active={tab === 'active'} badge={activeTasks.length} onPress={() => setTab('active')} />
          <TabBtn label="已完成" active={tab === 'done'} badge={doneTasks.length} onPress={() => setTab('done')} />
          <TabBtn label="已安装" active={tab === 'installed'} badge={updatableApps.length || undefined} onPress={() => setTab('installed')} />
        </View>
      </View>

      {/* ── 通知权限提示条 ── */}
      {Platform.OS !== 'web' && notifStatus !== 'granted' && notifStatus !== 'unavailable' && (
        <Pressable
          onPress={async () => {
            const granted = await requestNotificationPermission();
            if (granted) {
              setNotifStatus('granted');
            } else {
              const sub = AppState.addEventListener('change', async (state) => {
                if (state === 'active') {
                  sub.remove();
                  const s = await getNotificationPermissionStatus();
                  setNotifStatus(s);
                }
              });
            }
          }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8,
            backgroundColor: '#FFFBE6', paddingHorizontal: 16, paddingVertical: 10,
            borderBottomWidth: 0.5, borderBottomColor: '#FFE58F' }}>
          <Ionicons name="notifications-outline" size={16} color={ORANGE} />
          <Text style={{ flex: 1, fontSize: 13, color: '#7C4400' }}>
            {notifStatus === 'denied' ? '通知权限已拒绝，请在系统设置中开启' : '开启通知以接收下载进度和完成提醒'}
          </Text>
          {notifStatus !== 'denied' && (
            <Text style={{ fontSize: 13, color: ORANGE, fontWeight: '600' }}>开启</Text>
          )}
          <Ionicons name="chevron-forward" size={14} color={ORANGE} />
        </Pressable>
      )}

      {/* ── 标签内容 ── */}
      {tab === 'active' && (
        <FlatList data={activeTasks} keyExtractor={(item) => item.id}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ padding: 12, paddingBottom: 32 }}
          renderItem={renderActiveItem}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 72, gap: 10 }}>
              <Ionicons name="cloud-download-outline" size={52} color="#D0D0D0" />
              <Text style={{ color: '#AAA', fontSize: 15, fontWeight: '500' }}>暂无进行中的任务</Text>
              <Text style={{ color: '#CCC', fontSize: 12, textAlign: 'center', paddingHorizontal: 32 }}>
                浏览应用商店，找到喜欢的项目后点击下载
              </Text>
            </View>
          }
        />
      )}

      {tab === 'done' && (
        <FlatList data={doneTasks} keyExtractor={(item) => item.id}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ padding: 12, paddingBottom: 32 }}
          renderItem={renderDoneItem}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 72, gap: 10 }}>
              <Ionicons name="checkmark-done-circle-outline" size={52} color="#D0D0D0" />
              <Text style={{ color: '#AAA', fontSize: 15, fontWeight: '500' }}>暂无已完成的任务</Text>
            </View>
          }
        />
      )}

      {tab === 'installed' && (
        installedLoading
          ? <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color={BLUE} />
            </View>
          : <FlatList data={installed} keyExtractor={(item) => item.id}
              contentInsetAdjustmentBehavior="automatic"
              contentContainerStyle={{ padding: 12, paddingBottom: 32 }}
              renderItem={renderInstalledItem}
              ListHeaderComponent={installed.length > 0 ? (
                <View style={{ gap: 6, marginBottom: 10 }}>
                  {updatableApps.length > 0 && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8,
                      backgroundColor: '#FFF7E6', borderRadius: 12, padding: 12,
                      borderWidth: 1, borderColor: '#FFD591' }}>
                      <Ionicons name="arrow-up-circle-outline" size={18} color={ORANGE} />
                      <Text style={{ flex: 1, fontSize: 13, color: '#874D00' }}>
                        {updatableApps.length} 个应用有可用更新
                      </Text>
                    </View>
                  )}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6,
                    backgroundColor: '#F0F5FF', borderRadius: 10, padding: 10 }}>
                    <Ionicons name="information-circle-outline" size={15} color={BLUE} />
                    <Text style={{ fontSize: 12, color: '#555', flex: 1 }}>
                      共 {installed.length} 个已安装应用 · 打开应用时自动检查更新
                    </Text>
                  </View>
                </View>
              ) : null}
              ListEmptyComponent={
                <View style={{ alignItems: 'center', paddingTop: 72, gap: 10 }}>
                  <Ionicons name="phone-portrait-outline" size={52} color="#D0D0D0" />
                  <Text style={{ color: '#AAA', fontSize: 15, fontWeight: '500' }}>暂无已安装的应用</Text>
                  <Text style={{ color: '#CCC', fontSize: 12, textAlign: 'center', paddingHorizontal: 32 }}>
                    通过本应用下载并安装后，会自动出现在此处
                  </Text>
                </View>
              }
            />
      )}
    </SafeAreaView>
  );
}

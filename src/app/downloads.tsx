/**
 * 下载管理页面
 *
 * 功能：
 * - 进行中：进度、速度、暂停/恢复/取消（多线程标记）
 * - 已完成：文件大小、下载时间、打开/安装/删除
 * - 历史记录：从 SQLite 读取本地下载历史，仅本地数据，支持清除
 * - 通知权限状态提示
 * - 全部暂停 / 全部恢复 / 批量清除
 * - 存储目录信息
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, Platform, ScrollView, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { useFocusEffect } from 'expo-router';
import { useDownload } from '@/ctx/DownloadContext';
import { formatSpeed, formatBytes, isInstallerFile, hasDownloadsPermission } from '@/lib/downloadManager';
import { getDownloadHistory, clearDownloadHistory } from '@/lib/database';
import { getNotificationPermissionStatus, requestNotificationPermission } from '@/lib/notifications';
import type { DownloadTask } from '@/lib/downloadManager';
import type { DownloadRecord } from '@/types';

const BLUE = '#1677FF';
const GREEN = '#52C41A';
const RED = '#FF4D4F';
const ORANGE = '#FA8C16';
const RADIUS = 17;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

type TabKey = 'active' | 'done' | 'history';

// ── 进度环 ────────────────────────────────────────────────
function ProgressCircle({ progress, status }: { progress: number; status: string }) {
  const offset = CIRCUMFERENCE * (1 - Math.min(progress, 1));
  const color = status === 'failed' ? RED : status === 'completed' ? GREEN : BLUE;
  return (
    <View style={{ width: 44, height: 44 }}>
      <Svg width={44} height={44} viewBox="0 0 44 44">
        <Circle cx={22} cy={22} r={RADIUS} stroke="#EBEBEB" strokeWidth={3} fill="none" />
        {progress > 0 && (
          <Circle
            cx={22} cy={22} r={RADIUS}
            stroke={color} strokeWidth={3} fill="none"
            strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
            strokeDashoffset={offset}
            strokeLinecap="round" rotation={-90} origin="22,22"
          />
        )}
      </Svg>
      <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons
          name={status === 'completed' ? 'checkmark' : status === 'failed' ? 'close' :
            status === 'paused' ? 'pause' : 'arrow-down'}
          size={15} color={color}
        />
      </View>
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
        <Text style={{ fontSize: 14, fontWeight: active ? '700' : '400',
          color: active ? BLUE : '#888' }}>{label}</Text>
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
  const router = useRouter();
  const { tasks, pause, resume, cancel, deleteFile, clearFinished, pauseAll, resumeAll, retry } = useDownload();

  const [tab, setTab] = useState<TabKey>('active');
  const [history, setHistory] = useState<DownloadRecord[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const [safGranted, setSafGranted] = useState(false);
  const [notifStatus, setNotifStatus] = useState<'granted' | 'denied' | 'undetermined' | 'unavailable'>('undetermined');
  const [confirmClear, setConfirmClear] = useState<'finished' | 'history' | null>(null);

  // 分类任务
  const activeTasks = tasks.filter(
    (t) => t.status === 'pending' || t.status === 'downloading' || t.status === 'paused',
  );
  const doneTasks = tasks.filter(
    (t) => t.status === 'completed' || t.status === 'failed' || t.status === 'cancelled',
  );
  const allPaused = activeTasks.length > 0 && activeTasks.every((t) => t.status === 'paused');

  // 聚焦时刷新状态
  useFocusEffect(useCallback(() => {
    (async () => {
      setSafGranted(await hasDownloadsPermission());
      if (Platform.OS !== 'web') {
        const s = await getNotificationPermissionStatus();
        setNotifStatus(s);
      }
      if (tab === 'history') loadHistory();
    })();
  }, [tab]));

  // 切换到历史标签时加载
  useEffect(() => {
    if (tab === 'history') loadHistory();
  }, [tab]);

  const loadHistory = async () => {
    setHistLoading(true);
    try {
      const list = await getDownloadHistory();
      setHistory(list);
    } catch { /* ignore */ } finally {
      setHistLoading(false);
    }
  };

  // 自动跳转到有内容的 tab
  useEffect(() => {
    if (tab === 'active' && activeTasks.length === 0 && doneTasks.length > 0) setTab('done');
  }, [tasks.length]);

  // ── 统计总下载量 ─────────────────────────────────────────
  const totalDownloadedBytes = doneTasks.reduce((sum, t) => sum + (t.totalBytes || 0), 0);

  // ── 渲染：进行中任务行 ────────────────────────────────────
  const renderActiveItem = ({ item }: { item: DownloadTask }) => {
    const pct = Math.round(item.progress * 100);
    const spd = formatSpeed(item.speed);
    const isFailed = item.status === 'failed';

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
            {item.status === 'downloading' && (
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <Text style={{ fontSize: 12, color: BLUE, fontWeight: '600' }}>{pct}%</Text>
                {item.multiThreaded && (
                  <View style={{ backgroundColor: '#EEF5FF', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
                    <Text style={{ fontSize: 10, color: BLUE }}>多线程</Text>
                  </View>
                )}
                {spd ? <Text style={{ fontSize: 11, color: '#999' }}>{spd}</Text> : null}
                {item.totalBytes > 0 && (
                  <Text style={{ fontSize: 11, color: '#BBB' }}>
                    {formatBytes(item.bytesWritten)}/{formatBytes(item.totalBytes)}
                  </Text>
                )}
              </View>
            )}
            {item.status === 'paused' && (
              <Text style={{ fontSize: 12, color: ORANGE, fontWeight: '500' }}>已暂停 · {pct}%</Text>
            )}
            {item.status === 'pending' && (
              <Text style={{ fontSize: 12, color: '#AAA' }}>队列等待中…</Text>
            )}
            {isFailed && item.error && (
              <Text style={{ fontSize: 11, color: RED }} numberOfLines={2}>{item.error}</Text>
            )}
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {item.status === 'downloading' && (
              <ActionBtn icon="pause" color={ORANGE} bg="#FFF7E6" onPress={() => pause(item.id)} />
            )}
            {item.status === 'paused' && (
              <ActionBtn icon="play" color={BLUE} bg="#E6F7FF" onPress={() => resume(item.id)} />
            )}
            {(item.status === 'downloading' || item.status === 'paused' || item.status === 'pending') && (
              <ActionBtn icon="close" color={RED} bg="#FFF1F0" onPress={() => cancel(item.id)} />
            )}
            {isFailed && (
              <ActionBtn icon="refresh" color="#fff" bg={RED} label="重试" onPress={() => retry(item.id)} />
            )}
          </View>
        </View>
        {/* 进度条（下载中） */}
        {item.status === 'downloading' && item.totalBytes > 0 && (
          <View style={{ height: 3, backgroundColor: '#F0F0F0', borderRadius: 2, marginTop: 10 }}>
            <View style={{ width: `${pct}%`, height: '100%', backgroundColor: BLUE, borderRadius: 2 }} />
          </View>
        )}
      </View>
    );
  };

  // ── 渲染：已完成任务行 ────────────────────────────────────
  const renderDoneItem = ({ item }: { item: DownloadTask }) => {
    const isInstaller = isInstallerFile(item.filename);
    const statusLabel = item.status === 'failed' ? '失败' : item.status === 'cancelled' ? '已取消' : '完成';
    const statusColor = item.status === 'failed' ? RED : item.status === 'cancelled' ? '#AAA' : GREEN;

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
              <View style={{ backgroundColor: `${statusColor}15`, borderRadius: 6,
                paddingHorizontal: 6, paddingVertical: 2 }}>
                <Text style={{ fontSize: 11, color: statusColor, fontWeight: '600' }}>{statusLabel}</Text>
              </View>
            </View>
            <Text style={{ fontSize: 12, color: '#888' }} numberOfLines={1}>{item.filename}</Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {item.totalBytes > 0 && (
                <Text style={{ fontSize: 11, color: '#AAA' }}>{formatBytes(item.totalBytes)}</Text>
              )}
              <Text style={{ fontSize: 11, color: '#BBB' }}>
                {new Date(item.createdAt).toLocaleDateString('zh-CN')} {new Date(item.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
              </Text>
              {item.multiThreaded && (
                <View style={{ backgroundColor: '#EEF5FF', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
                  <Text style={{ fontSize: 10, color: BLUE }}>多线程</Text>
                </View>
              )}
            </View>
            {item.status === 'failed' && item.error && (
              <Text style={{ fontSize: 11, color: RED }} numberOfLines={1}>{item.error}</Text>
            )}
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {item.status === 'completed' && item.localUri && (
              <ActionBtn
                icon={isInstaller ? 'phone-portrait-outline' : 'open-outline'}
                color={GREEN} bg="#F6FFED"
                label={isInstaller ? '安装' : '打开'}
                onPress={async () => {
                  try {
                    if (Platform.OS === 'android' && isInstaller) {
                      // Android：用 Linking 打开 content:// URI 触发系统安装界面
                      // content:// URI 由 SAF 返回，系统会调用 PackageInstaller
                      const canOpen = await Linking.canOpenURL(item.localUri!);
                      if (canOpen) {
                        await Linking.openURL(item.localUri!);
                      } else {
                        // fallback：expo-sharing
                        const Sharing = await import('expo-sharing');
                        if (await Sharing.isAvailableAsync()) {
                          await Sharing.shareAsync(item.localUri!, {
                            mimeType: 'application/vnd.android.package-archive',
                            dialogTitle: '安装应用',
                          });
                        }
                      }
                    } else {
                      // iOS / Web / 非安装文件：系统分享/打开
                      const Sharing = await import('expo-sharing');
                      if (await Sharing.isAvailableAsync()) {
                        await Sharing.shareAsync(item.localUri!, {
                          mimeType: isInstallerFile(item.filename) ? 'application/vnd.android.package-archive' : 'application/octet-stream',
                          dialogTitle: isInstaller ? '安装应用' : '查看文件',
                        });
                      }
                    }
                  } catch { /* ignore */ }
                }}
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

  // ── 渲染：历史记录行 ──────────────────────────────────────
  const renderHistoryItem = ({ item }: { item: DownloadRecord }) => (
    <Pressable
      onPress={() => {
        if (item.owner && item.repo) {
          router.push({ pathname: '/detail/[id]', params: { id: String(item.app_id), owner: item.owner, repo: item.repo } } as any);
        }
      }}
      style={{ backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8,
        flexDirection: 'row', gap: 12, alignItems: 'center', borderWidth: 0.5, borderColor: '#F0F0F0' }}
    >
      <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: `${GREEN}15`,
        alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="checkmark-circle-outline" size={22} color={GREEN} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ fontWeight: '600', color: '#1A1A1A', fontSize: 15 }} numberOfLines={1}>
          {item.app_name}
        </Text>
        <Text style={{ fontSize: 12, color: '#888' }} numberOfLines={1}>
          {item.version ? `v${item.version}` : ''} · {item.owner}/{item.repo}
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {item.file_size > 0 && (
            <Text style={{ fontSize: 11, color: '#AAA' }}>{formatBytes(item.file_size)}</Text>
          )}
          <Text style={{ fontSize: 11, color: '#BBB' }}>
            {new Date(item.download_time).toLocaleDateString('zh-CN')}
          </Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={15} color="#D0D0D0" />
    </Pressable>
  );

  // ── 主渲染 ────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F6F8' }} edges={['top']}>

      {/* ── 确认弹窗 ── */}
      {confirmClear && (
        <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)',
          zIndex: 100, alignItems: 'center', justifyContent: 'center' } as any}>
          <View style={{ backgroundColor: '#fff', borderRadius: 18, padding: 24, width: 296, gap: 14 }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: '#1A1A1A', textAlign: 'center' }}>
              {confirmClear === 'history' ? '清除本地历史记录' : '清除已完成任务'}
            </Text>
            <Text style={{ fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 20 }}>
              {confirmClear === 'history'
                ? '仅删除本地记录（不删除已下载文件），操作不可撤销'
                : '将移除所有已完成、失败、已取消的任务记录（不删除本地文件）'}
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable onPress={() => setConfirmClear(null)}
                style={{ flex: 1, height: 44, borderRadius: 10, borderWidth: 1,
                  borderColor: '#E0E0E0', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#666', fontWeight: '500' }}>取消</Text>
              </Pressable>
              <Pressable
                onPress={async () => {
                  const target = confirmClear;
                  setConfirmClear(null);
                  if (target === 'finished') {
                    clearFinished();
                  } else if (target === 'history') {
                    await clearDownloadHistory();
                    setHistory([]);
                  }
                }}
                style={{ flex: 1, height: 44, borderRadius: 10,
                  backgroundColor: RED, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#fff', fontWeight: '600' }}>确认清除</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* ── 头部 ── */}
      <View style={{ backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#EBEBEB' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={{ marginRight: 12 }}>
            <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
          </Pressable>
          <Text style={{ flex: 1, fontSize: 18, fontWeight: '700' }}>下载管理</Text>
          {/* 全局操作 */}
          {tab === 'active' && activeTasks.length > 0 && (
            <Pressable
              onPress={() => allPaused ? resumeAll() : pauseAll()}
              style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
                backgroundColor: '#F0F5FF', marginRight: 6 }}>
              <Text style={{ fontSize: 13, color: BLUE, fontWeight: '500' }}>
                {allPaused ? '全部恢复' : '全部暂停'}
              </Text>
            </Pressable>
          )}
          {tab === 'done' && doneTasks.length > 0 && (
            <Pressable onPress={() => setConfirmClear('finished')} hitSlop={8}>
              <Text style={{ color: RED, fontSize: 13, fontWeight: '500' }}>清除记录</Text>
            </Pressable>
          )}
          {tab === 'history' && history.length > 0 && (
            <Pressable onPress={() => setConfirmClear('history')} hitSlop={8}>
              <Text style={{ color: RED, fontSize: 13, fontWeight: '500' }}>清除历史</Text>
            </Pressable>
          )}
        </View>

        {/* ── 标签栏 ── */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 8 }}>
          <TabBtn label="进行中" active={tab === 'active'} badge={activeTasks.length} onPress={() => setTab('active')} />
          <TabBtn label="已完成" active={tab === 'done'} badge={doneTasks.length} onPress={() => setTab('done')} />
          <TabBtn label="历史记录" active={tab === 'history'} badge={history.length} onPress={() => setTab('history')} />
        </View>
      </View>

      {/* ── 通知权限提示条 ── */}
      {Platform.OS !== 'web' && notifStatus !== 'granted' && notifStatus !== 'unavailable' && (
        <Pressable
          onPress={async () => {
            const granted = await requestNotificationPermission();
            setNotifStatus(granted ? 'granted' : 'denied');
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

      {/* ── 存储信息卡（Android SAF）── */}
      {Platform.OS === 'android' && tab === 'active' && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8,
          backgroundColor: safGranted ? '#F6FFED' : '#FFF7E6',
          paddingHorizontal: 16, paddingVertical: 8,
          borderBottomWidth: 0.5, borderBottomColor: safGranted ? '#D9F7BE' : '#FFE7BA' }}>
          <Ionicons name={safGranted ? 'folder-open-outline' : 'folder-outline'} size={15}
            color={safGranted ? GREEN : ORANGE} />
          <Text style={{ flex: 1, fontSize: 12, color: safGranted ? '#389E0D' : '#874D00' }}>
            {safGranted
              ? `文件保存至 Download/开源应用商店/  ·  本次累计 ${formatBytes(totalDownloadedBytes)}`
              : '未授权 Downloads 目录，文件将保存到应用缓存区'}
          </Text>
          {totalDownloadedBytes > 0 && safGranted && (
            <Text style={{ fontSize: 11, color: GREEN, fontWeight: '600' }}>{formatBytes(totalDownloadedBytes)}</Text>
          )}
        </View>
      )}

      {/* ── 标签内容 ── */}
      {tab === 'active' && (
        <FlatList
          data={activeTasks}
          keyExtractor={(item) => item.id}
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
        <FlatList
          data={doneTasks}
          keyExtractor={(item) => item.id}
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

      {tab === 'history' && (
        histLoading
          ? <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color={BLUE} />
            </View>
          : <FlatList
              data={history}
              keyExtractor={(item) => item.id}
              contentInsetAdjustmentBehavior="automatic"
              contentContainerStyle={{ padding: 12, paddingBottom: 32 }}
              renderItem={renderHistoryItem}
              ListHeaderComponent={history.length > 0 ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6,
                  backgroundColor: '#F0F5FF', borderRadius: 10, padding: 10, marginBottom: 10 }}>
                  <Ionicons name="information-circle-outline" size={15} color={BLUE} />
                  <Text style={{ fontSize: 12, color: '#555', flex: 1 }}>
                    以下为本地下载历史记录（仅本机数据），共 {history.length} 条
                  </Text>
                </View>
              ) : null}
              ListEmptyComponent={
                <View style={{ alignItems: 'center', paddingTop: 72, gap: 10 }}>
                  <Ionicons name="time-outline" size={52} color="#D0D0D0" />
                  <Text style={{ color: '#AAA', fontSize: 15, fontWeight: '500' }}>暂无下载历史</Text>
                  <Text style={{ color: '#CCC', fontSize: 12 }}>历史记录仅保存在本机</Text>
                </View>
              }
            />
      )}
    </SafeAreaView>
  );
}
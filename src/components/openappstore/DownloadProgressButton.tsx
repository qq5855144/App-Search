import React from 'react';
/**
 * 下载进度按钮
 * 状态：初始 → 下载中（进度圆弧 + 速度）→ 完成 → 安装/查看
 * - 安装包（APK/IPA/EXE/MSI/DMG/DEB/RPM/AppImage）：显示「安装」，调起系统安装器
 *   · Android APK 下载完成后自动弹出安装器
 * - 其他文件：显示「查看」，调起系统推荐打开方式
 * - 失败：显示错误摘要 + 重试按钮
 * - 重试：清除旧任务再重新入队，彻底解决重试无效问题
 */
import { View, Text, Pressable, Platform, Linking } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useDownload } from '@/ctx/DownloadContext';
import { formatSpeed, getMimeType, isInstallerFile, BROWSER_DOWNLOAD_MARKER } from '@/lib/downloadManager';
import type { DownloadTask } from '@/lib/downloadManager';

interface Props {
  downloadUrl: string;
  filename: string;
  appId: number;
  appName: string;
  owner: string;
  repo: string;
  avatarUrl: string;
  version: string;
  /** 紧凑模式：用于 AppCard 列表场景 */
  compact?: boolean;
}

const BLUE   = '#1677FF';
const GREEN  = '#52C41A';
const ORANGE = '#FA8C16';
const RED    = '#FF4D4F';
const RADIUS = 11;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * 打开 / 安装已下载的文件。
 * - 安装包：调起系统安装器（shareAsync 会路由到包安装器）
 * - 其他文件：调起系统推荐的打开应用
 * 返回成功与否及错误描述。
 */
async function openLocalFile(
  localUri: string,
  filename: string
): Promise<{ ok: boolean; error?: string }> {
  if (Platform.OS === 'web') return { ok: false, error: 'Web 平台不支持本地文件操作' };
  if (!localUri) return { ok: false, error: '文件路径无效' };
  try {
    const mimeType = getMimeType(filename);
    // 动态导入，避免 web bundle 包含 expo-sharing
    const Sharing = await import('expo-sharing');
    const available = await Sharing.isAvailableAsync();
    if (!available) return { ok: false, error: '当前设备不支持文件分享/打开' };
    await Sharing.shareAsync(localUri, {
      mimeType,
      dialogTitle: isInstallerFile(filename) ? '安装应用' : '查看文件',
    });
    return { ok: true };
  } catch (e: any) {
    const msg: string = e?.message ?? '';
    if (msg.includes('No Activity') || msg.includes('no activity')) {
      return { ok: false, error: '未找到可处理该文件的应用' };
    }
    if (msg.includes('Permission') || msg.includes('permission')) {
      return { ok: false, error: '权限不足，无法访问文件' };
    }
    return { ok: false, error: '无法打开文件，请检查文件是否存在' };
  }
}

export default function DownloadProgressButton({
  downloadUrl, filename, appId, appName, owner, repo, avatarUrl, version,
  compact = false,
}: Props) {
  const { enqueue, retry, pause, resume, cancel, findByUrl } = useDownload();
  const taskRef = useRef<DownloadTask | undefined>(undefined);
  // 每次渲染时更新 taskRef，避免闭包过期
  taskRef.current = findByUrl(downloadUrl);
  const task = taskRef.current;
  const status = task?.status;
  const isInstaller = isInstallerFile(filename);

  // 文件打开失败时的内联错误提示
  const [openError, setOpenError] = useState<string | null>(null);

  // 下载完成后自动调起安装器（仅 iOS APK / 非系统下载任务）
  // 初始值：若挂载时任务已完成则置 true，避免页面切换回来时重复弹窗
  const autoInstallFiredRef = useRef(task?.status === 'completed');
  useEffect(() => {
    if (
      status === 'completed' &&
      task?.localUri &&
      task.localUri !== BROWSER_DOWNLOAD_MARKER && // Android 系统下载不自动弹
      filename.toLowerCase().endsWith('.apk') &&
      Platform.OS === 'android' &&
      !autoInstallFiredRef.current
    ) {
      autoInstallFiredRef.current = true;
      import('expo-file-system').then((fs) => {
        fs.getInfoAsync(task.localUri!).then((info: any) => {
          if (info.exists) {
            openLocalFile(task.localUri!, filename).then(({ ok, error }) => {
              if (!ok && error) setOpenError(error);
            });
          }
        }).catch(() => {});
      }).catch(() => {});
    }
  }, [status, task?.localUri, filename]);

  const handlePress = async () => {
    setOpenError(null);
    if (!downloadUrl) {
      setOpenError('下载链接无效');
      return;
    }
    if (!task || status === 'cancelled') {
      enqueue({ url: downloadUrl, filename, appId, appName, owner, repo, avatarUrl, version });
      return;
    }
    if (status === 'failed') {
      retry(task.id);
      return;
    }
    if (status === 'completed') {
      if (task.localUri === BROWSER_DOWNLOAD_MARKER) {
        // Android 系统下载：文件由系统 DownloadManager 托管，打开系统下载页
        Linking.openURL('content://downloads/my_downloads').catch(() =>
          Linking.openURL('content://downloads').catch(() => null)
        );
      } else if (task.localUri) {
        const { ok, error } = await openLocalFile(task.localUri, filename);
        if (!ok && error) setOpenError(error);
      } else {
        setOpenError('文件路径丢失，请重新下载');
      }
      return;
    }
    if (status === 'downloading') { pause(task.id); return; }
    if (status === 'paused')      { resume(task.id); return; }
    if (status === 'pending')     { cancel(task.id); return; }
  };

  // ── 已完成 ──────────────────────────────────────────
  if (status === 'completed') {
    // Android 系统下载：文件由系统 DownloadManager 托管，显示"在通知栏查看"
    if (task?.localUri === BROWSER_DOWNLOAD_MARKER) {
      return (
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Pressable
            onPress={handlePress}
            style={{
              paddingHorizontal: compact ? 12 : 16,
              paddingVertical: compact ? 6 : 9,
              borderRadius: 24,
              backgroundColor: GREEN,
            }}
          >
            <Text style={{ fontSize: compact ? 12 : 13, fontWeight: '600', color: '#FFFFFF' }}>
              查看下载
            </Text>
          </Pressable>
          <Text style={{ fontSize: 10, color: '#999999', maxWidth: 120, textAlign: 'right' }}>
            在通知栏或系统下载中查看
          </Text>
        </View>
      );
    }
    return (
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <Pressable
          onPress={handlePress}
          style={{
            paddingHorizontal: compact ? 12 : 16,
            paddingVertical: compact ? 6 : 9,
            borderRadius: 24,
            backgroundColor: GREEN,
          }}
        >
          <Text style={{ fontSize: compact ? 12 : 13, fontWeight: '600', color: '#FFFFFF' }}>
            {isInstaller ? '安装' : '查看'}
          </Text>
        </Pressable>
        {openError && (
          <Text style={{ fontSize: 10, color: RED, maxWidth: 120, textAlign: 'right' }}>
            {openError}
          </Text>
        )}
      </View>
    );
  }

  // ── 下载中 / 暂停 / 排队 ──────────────────────────
  if (task && (status === 'downloading' || status === 'paused' || status === 'pending')) {
    const progress = task.progress;
    const strokeDashoffset = CIRCUMFERENCE * (1 - progress);
    const isPaused  = status === 'paused';
    const isPending = status === 'pending';
    const accentColor = isPaused ? ORANGE : BLUE;

    if (compact) {
      return (
        <Pressable
          onPress={handlePress}
          style={{ alignItems: 'center', justifyContent: 'center', width: 48, height: 32 }}
        >
          <Svg width={28} height={28} viewBox="0 0 28 28">
            <Circle cx={14} cy={14} r={RADIUS} stroke="#E0E0E0" strokeWidth={2.5} fill="none" />
            {!isPending && (
              <Circle
                cx={14} cy={14} r={RADIUS}
                stroke={accentColor} strokeWidth={2.5} fill="none"
                strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round" rotation={-90} origin="14,14"
              />
            )}
          </Svg>
          <View style={{ position: 'absolute' }}>
            <Ionicons
              name={isPending ? 'hourglass-outline' : isPaused ? 'play' : 'pause'}
              size={11} color={accentColor}
            />
          </View>
        </Pressable>
      );
    }

    const percent   = Math.round(progress * 100);
    const speedStr  = formatSpeed(task.speed);
    // 断点续传状态：pending 且已有历史进度（iOS 跨会话恢复 / 弱网重试）
    const hasResume = isPending && task.bytesWritten > 0 && progress > 0;
    return (
      <Pressable onPress={handlePress} style={{ alignItems: 'center', gap: 4, minWidth: 60 }}>
        <View style={{ position: 'relative', width: 44, height: 44 }}>
          <Svg width={44} height={44} viewBox="0 0 44 44">
            <Circle cx={22} cy={22} r={18} stroke="#E5E5E5" strokeWidth={3} fill="none" />
            {/* pending 且有断点进度时也绘制圆弧，直观展示已下载量 */}
            {(!isPending || hasResume) && (
              <Circle
                cx={22} cy={22} r={18}
                stroke={accentColor} strokeWidth={3} fill="none"
                strokeDasharray={`${2 * Math.PI * 18} ${2 * Math.PI * 18}`}
                strokeDashoffset={(2 * Math.PI * 18) * (1 - (hasResume ? progress : progress))}
                strokeLinecap="round" rotation={-90} origin="22,22"
              />
            )}
          </Svg>
          <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
            {isPending && !hasResume
              ? <Ionicons name="hourglass-outline" size={16} color="#AAAAAA" />
              : <Ionicons name={isPaused ? 'play' : isPending ? 'refresh' : 'pause'} size={15} color={accentColor} />}
          </View>
        </View>
        <Text style={{ fontSize: 11, color: accentColor, fontWeight: '600' }}>
          {isPending
            ? (hasResume ? `${percent}% 续传` : '等待中')
            : isPaused ? `${percent}% 已暂停` : `${percent}%`}
        </Text>
        {speedStr && !isPaused && !isPending
          ? <Text style={{ fontSize: 10, color: '#999999' }}>{speedStr}</Text>
          : null}
        {/* 弱网重试时展示重试次数 */}
        {task.error && isPending && (
          <Text numberOfLines={1} style={{ fontSize: 9, color: '#AAAAAA', maxWidth: 80, textAlign: 'center' }}>
            {task.error}
          </Text>
        )}
      </Pressable>
    );
  }

  // ── 失败 ────────────────────────────────────────────
  if (status === 'failed') {
    return (
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <Pressable
          onPress={handlePress}
          style={{
            paddingHorizontal: compact ? 12 : 16,
            paddingVertical: compact ? 6 : 9,
            borderRadius: 24,
            backgroundColor: RED,
          }}
        >
          <Text style={{ fontSize: compact ? 12 : 13, fontWeight: '600', color: '#FFFFFF' }}>
            重试
          </Text>
        </Pressable>
        {/* 失败原因摘要（最多 2 行，超出省略） */}
        {task?.error && (
          <Text
            numberOfLines={2}
            style={{ fontSize: 10, color: RED, maxWidth: compact ? 90 : 130, textAlign: 'right' }}
          >
            {task.error}
          </Text>
        )}
      </View>
    );
  }

  // ── 初始状态 ─────────────────────────────────────────
  return (
    <Pressable
      onPress={handlePress}
      style={{
        paddingHorizontal: compact ? 12 : 16,
        paddingVertical: compact ? 6 : 9,
        borderRadius: 24,
        borderWidth: 1.5,
        borderColor: BLUE,
        backgroundColor: '#FFFFFF',
      }}
    >
      <Text style={{ fontSize: compact ? 12 : 13, fontWeight: '600', color: BLUE }}>
        下载
      </Text>
    </Pressable>
  );
}

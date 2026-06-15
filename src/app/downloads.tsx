import { View, Text, Pressable, FlatList, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import { useDownload } from '@/ctx/DownloadContext';
import { formatSpeed, formatBytes } from '@/lib/downloadManager';
import type { DownloadTask } from '@/lib/downloadManager';
import AppIcon from '@/components/openappstore/AppIcon';
import EmptyState from '@/components/openappstore/EmptyState';

const CARD_SHADOW = [{ offsetX: 0, offsetY: 1, blurRadius: 4, color: 'rgba(0,0,0,0.07)' }] as const;

// 状态配置
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending:     { label: '等待中', color: '#FAAD14', bg: '#FFFBE6' },
  downloading: { label: '下载中', color: '#1677FF', bg: '#EBF3FF' },
  paused:      { label: '已暂停', color: '#FA8C16', bg: '#FFF7E6' },
  completed:   { label: '已完成', color: '#52C41A', bg: '#F6FFED' },
  failed:      { label: '失败',   color: '#FF4D4F', bg: '#FFF1F0' },
  cancelled:   { label: '已取消', color: '#AAAAAA', bg: '#F5F5F5' },
};

function ProgressBar({ progress, color }: { progress: number; color: string }) {
  return (
    <View style={{ height: 4, backgroundColor: '#EFEFEF', borderRadius: 4, overflow: 'hidden', marginTop: 8 }}>
      <View style={{ height: 4, width: `${Math.round(progress * 100)}%` as any, backgroundColor: color, borderRadius: 4 }} />
    </View>
  );
}

function DownloadItem({ task }: { task: DownloadTask }) {
  const { pause, resume, cancel, deleteFile } = useDownload();
  const router = useRouter();
  const cfg = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.pending;
  const isActive = task.status === 'downloading' || task.status === 'paused' || task.status === 'pending';
  const percent = Math.round(task.progress * 100);

  // BUG 3 修复：Linking.openURL(file://) 在 Android 无法触发 APK 安装（需 FileProvider），
  // 改用 expo-sharing.shareAsync，与 DownloadProgressButton 保持一致。
  // 同时按文件名判断 APK / 非 APK，非 APK 显示「打开」。
  const isApk = task.filename.toLowerCase().endsWith('.apk');

  const handleOpen = async () => {
    if (!task.localUri) return;
    if (Platform.OS === 'web') return;
    try {
      const mimeType = isApk
        ? 'application/vnd.android.package-archive'
        : 'application/octet-stream';
      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(task.localUri, { mimeType, dialogTitle: '打开文件' });
      }
    } catch {
      // ignore
    }
  };

  return (
    <Pressable
      onPress={() => router.push({ pathname: `/detail/${task.appId}`, params: { owner: task.owner, repo: task.repo } } as any)}
      style={{
        backgroundColor: '#FFFFFF',
        marginHorizontal: 16,
        marginBottom: 10,
        borderRadius: 16,
        padding: 14,
        boxShadow: CARD_SHADOW,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <AppIcon owner={task.owner} repo={task.repo} url={task.avatarUrl} name={task.appName} size={44} />

        <View style={{ flex: 1, gap: 3 }}>
          {/* 应用名 + 状态徽标 */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#1A1A1A', flex: 1 }} numberOfLines={1}>
              {task.appName}
            </Text>
            <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20, backgroundColor: cfg.bg }}>
              <Text style={{ fontSize: 11, color: cfg.color, fontWeight: '500' }}>{cfg.label}</Text>
            </View>
          </View>

          {/* 文件名 + 版本 */}
          <Text style={{ fontSize: 12, color: '#999999' }} numberOfLines={1}>
            {task.filename} · v{task.version}
          </Text>

          {/* 进度条（活跃状态） */}
          {isActive && (
            <>
              <ProgressBar progress={task.progress} color={cfg.color} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                <Text style={{ fontSize: 11, color: '#999999' }}>
                  {formatBytes(task.bytesWritten)}
                  {task.totalBytes > 0 ? ` / ${formatBytes(task.totalBytes)}` : ''}
                </Text>
                <Text style={{ fontSize: 11, color: cfg.color, fontWeight: '500' }}>
                  {task.status === 'downloading' && task.speed > 0
                    ? formatSpeed(task.speed)
                    : `${percent}%`}
                </Text>
              </View>
            </>
          )}

          {/* 完成：文件大小 */}
          {task.status === 'completed' && task.totalBytes > 0 && (
            <Text style={{ fontSize: 12, color: '#999999', marginTop: 2 }}>
              {formatBytes(task.totalBytes)}
            </Text>
          )}
        </View>

        {/* 操作按钮组 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {task.status === 'downloading' && (
            <Pressable
              onPress={() => pause(task.id)}
              style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="pause" size={16} color="#555555" />
            </Pressable>
          )}
          {task.status === 'paused' && (
            <Pressable
              onPress={() => resume(task.id)}
              style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#EBF3FF', alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="play" size={16} color="#1677FF" />
            </Pressable>
          )}
          {task.status === 'completed' && (
            <>
              <Pressable
                onPress={handleOpen}
                style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#52C41A' }}
              >
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#FFFFFF' }}>
                  {isApk ? '安装' : '打开'}
                </Text>
              </Pressable>
              {/* 删除本地文件 */}
              <Pressable
                onPress={() => deleteFile(task.id)}
                style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="trash-outline" size={16} color="#FF4D4F" />
              </Pressable>
            </>
          )}
          {(task.status === 'failed') && (
            <View style={{ paddingHorizontal: 8, paddingVertical: 6 }}>
              <Text style={{ fontSize: 12, color: '#FF4D4F' }} numberOfLines={2}>{task.error}</Text>
            </View>
          )}
          {/* 取消/删除 */}
          {(isActive || task.status === 'failed') && (
            <Pressable
              onPress={() => cancel(task.id)}
              style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFF1F0', alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="close" size={16} color="#FF4D4F" />
            </Pressable>
          )}
        </View>
      </View>
    </Pressable>
  );
}

// 安装引导提示卡片
function InstallGuideCard() {
  return (
    <View style={{
      marginHorizontal: 16, marginBottom: 12, padding: 14,
      backgroundColor: '#EBF3FF', borderRadius: 14,
      flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    }}>
      <Ionicons name="information-circle-outline" size={18} color="#1677FF" style={{ marginTop: 1 }} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: '#1677FF' }}>安装说明</Text>
        <Text style={{ fontSize: 12, color: '#555555', lineHeight: 18 }}>
          Android：下载完成后点击"安装"，系统弹窗提示时允许安装未知来源应用即可完成安装。{'\n'}
          iOS：请通过 TestFlight 或企业证书渠道安装 .ipa 文件。{'\n'}
          桌面端：下载完成后请在文件管理器中找到文件并手动安装。
        </Text>
      </View>
    </View>
  );
}

export default function DownloadsScreen() {
  const router = useRouter();
  const { tasks, clearFinished, activeCount } = useDownload();

  const active = tasks.filter((t) => ['pending', 'downloading', 'paused'].includes(t.status));
  const finished = tasks.filter((t) => ['completed', 'failed', 'cancelled'].includes(t.status));

  const listData: Array<{ type: 'header' | 'guide' | 'task' | 'section'; data?: DownloadTask; label?: string }> = [];

  if (active.length > 0) {
    listData.push({ type: 'section', label: `下载队列 (${active.length})` });
    active.forEach((t) => listData.push({ type: 'task', data: t }));
    listData.push({ type: 'guide' });
  }

  if (finished.length > 0) {
    listData.push({ type: 'section', label: '已完成' });
    finished.forEach((t) => listData.push({ type: 'task', data: t }));
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F5F5' }} edges={['top']}>
      {/* 顶部导航 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 8 }}>
        <Pressable
          onPress={() => router.back()}
          style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 }}
        >
          <Ionicons name="arrow-back" size={22} color="#1A1A1A" />
        </Pressable>
        <Text style={{ flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '600', color: '#1A1A1A', marginRight: 40 }}>
          下载中心
          {activeCount > 0 ? `  (${activeCount})` : ''}
        </Text>
        {finished.length > 0 && (
          <Pressable
            onPress={clearFinished}
            style={{ position: 'absolute', right: 16 }}
          >
            <Text style={{ fontSize: 14, color: '#FF4D4F' }}>清空记录</Text>
          </Pressable>
        )}
      </View>

      <FlatList
        data={listData}
        keyExtractor={(item, idx) =>
          item.type === 'task' ? item.data!.id : `${item.type}_${idx}`
        }
        renderItem={({ item }) => {
          if (item.type === 'section') {
            return (
              <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#888888', textTransform: 'uppercase' }}>
                  {item.label}
                </Text>
              </View>
            );
          }
          if (item.type === 'guide') {
            return <InstallGuideCard />;
          }
          if (item.type === 'task' && item.data) {
            return <DownloadItem task={item.data} />;
          }
          return null;
        }}
        ListEmptyComponent={
          <EmptyState title="暂无下载任务" description={'在应用详情页点击"下载"开始下载'} />
        }
        contentContainerStyle={{ paddingBottom: 32, paddingTop: 4 }}
      />
    </SafeAreaView>
  );
}

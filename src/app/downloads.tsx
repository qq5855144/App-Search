/**
 * 下载管理页面
 *
 * 功能：
 * - 正在下载：进度、速度、暂停/恢复/取消
 * - 已完成：文件大小、下载时间、打开/删除
 * - 全部暂停 / 全部恢复
 * - 清空已完成
 * - 下拉进入详情页
 */
import React from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { useDownload } from '@/ctx/DownloadContext';
import { formatSpeed, formatBytes, isInstallerFile } from '@/lib/downloadManager';
import type { DownloadTask } from '@/lib/downloadManager';

const BLUE = '#1677FF';
const GREEN = '#52C41A';
const RED = '#FF4D4F';
const RADIUS = 17;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function ProgressCircle({ progress, status }: { progress: number; status: string }) {
  const offset = CIRCUMFERENCE * (1 - Math.min(progress, 1));
  const color = status === 'failed' ? RED : status === 'completed' ? GREEN : BLUE;
  return (
    <View style={{ width: 44, height: 44, position: 'relative' }}>
      <Svg width={44} height={44} viewBox="0 0 44 44">
        <Circle cx={22} cy={22} r={RADIUS} stroke="#E5E5E5" strokeWidth={3} fill="none" />
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
          name={status === 'completed' ? 'checkmark' : status === 'failed' ? 'close' : 'arrow-down'}
          size={16} color={color}
        />
      </View>
    </View>
  );
}

export default function DownloadsScreen() {
  const router = useRouter();
  const { tasks, pause, resume, cancel, deleteFile, clearFinished, pauseAll, resumeAll, retry } = useDownload();

  const activeTasks = tasks.filter((t) => t.status === 'pending' || t.status === 'downloading' || t.status === 'paused');
  const completedTasks = tasks.filter((t) => t.status === 'completed' || t.status === 'failed' || t.status === 'cancelled');
  const hasActive = activeTasks.length > 0;
  const allPaused = activeTasks.every((t) => t.status === 'paused');

  const renderActiveItem = ({ item }: { item: DownloadTask }) => {
    const percent = Math.round(item.progress * 100);
    const speedStr = formatSpeed(item.speed);

    return (
      <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8 }}>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <ProgressCircle progress={item.progress} status={item.status} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ fontWeight: '600', color: '#1A1A1A', fontSize: 15 }} numberOfLines={1}>
              {item.appName}
            </Text>
            <Text style={{ fontSize: 12, color: '#888' }} numberOfLines={1}>
              {item.filename}
            </Text>
            {item.status === 'downloading' && (
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <Text style={{ fontSize: 12, color: BLUE, fontWeight: '600' }}>
                  {percent}%
                  {item.multiThreaded && ' · 多线程'}
                </Text>
                {speedStr ? (
                  <Text style={{ fontSize: 11, color: '#999' }}>{speedStr}</Text>
                ) : null}
              </View>
            )}
            {item.status === 'paused' && (
              <Text style={{ fontSize: 12, color: '#FA8C16', fontWeight: '500' }}>已暂停 {percent}%</Text>
            )}
            {item.status === 'pending' && (
              <Text style={{ fontSize: 12, color: '#AAA' }}>等待中...</Text>
            )}
            {item.status === 'failed' && item.error && (
              <Text style={{ fontSize: 11, color: RED }} numberOfLines={1}>{item.error}</Text>
            )}
          </View>
          {/* 操作按钮 */}
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {item.status === 'downloading' && (
              <Pressable
                onPress={() => pause(item.id)}
                style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFF7E6', alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="pause" size={18} color="#FA8C16" />
              </Pressable>
            )}
            {item.status === 'paused' && (
              <Pressable
                onPress={() => resume(item.id)}
                style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#E6F7FF', alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="play" size={18} color={BLUE} />
              </Pressable>
            )}
            {(item.status === 'downloading' || item.status === 'paused' || item.status === 'pending') && (
              <Pressable
                onPress={() => cancel(item.id)}
                style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFF1F0', alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="close" size={18} color={RED} />
              </Pressable>
            )}
            {item.status === 'failed' && (
              <Pressable
                onPress={() => retry(item.id)}
                style={{ paddingHorizontal: 12, height: 36, borderRadius: 18, backgroundColor: RED, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>重试</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderCompletedItem = ({ item }: { item: DownloadTask }) => {
    const isInstaller = isInstallerFile(item.filename);
    return (
      <Pressable
        onPress={() => {
          if (item.owner && item.repo) {
            router.push({ pathname: '/detail/[id]', params: { id: String(item.appId), owner: item.owner, repo: item.repo } } as any);
          }
        }}
        style={{ backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8, flexDirection: 'row', gap: 12, alignItems: 'center' }}
      >
        <ProgressCircle progress={item.progress} status={item.status} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ fontWeight: '600', color: '#1A1A1A', fontSize: 15 }} numberOfLines={1}>
            {item.appName}
          </Text>
          <Text style={{ fontSize: 12, color: '#888' }} numberOfLines={1}>
            {item.filename}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {item.totalBytes > 0 && (
              <Text style={{ fontSize: 11, color: '#AAA' }}>{formatBytes(item.totalBytes)}</Text>
            )}
            <Text style={{ fontSize: 11, color: '#AAA' }}>
              {new Date(item.createdAt).toLocaleDateString('zh-CN')}
            </Text>
            {item.multiThreaded && (
              <Text style={{ fontSize: 11, color: BLUE }}>多线程</Text>
            )}
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {item.status === 'completed' && item.localUri && (
            <Pressable
              onPress={async () => {
                try {
                  const Sharing = await import('expo-sharing');
                  const available = await Sharing.isAvailableAsync();
                  if (available) {
                    await Sharing.shareAsync(item.localUri!, {
                      mimeType: isInstallerFile(item.filename) ? 'application/vnd.android.package-archive' : 'application/octet-stream',
                      dialogTitle: isInstaller ? '安装应用' : '查看文件',
                    });
                  }
                } catch { /* ignore */ }
              }}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#F6FFED', alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name={isInstaller ? 'phone-portrait-outline' : 'open-outline'} size={18} color={GREEN} />
            </Pressable>
          )}
          <Pressable
            onPress={() => deleteFile(item.id)}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFF1F0', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="trash-outline" size={18} color={RED} />
          </Pressable>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F6F8' }} edges={['top']}>
      {/* 头部 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#E8E8E8' }}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={{ marginRight: 12 }}>
          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
        </Pressable>
        <Text style={{ flex: 1, fontSize: 18, fontWeight: '700' }}>下载管理</Text>
        {hasActive && (
          <Pressable
            onPress={() => allPaused ? resumeAll() : pauseAll()}
            style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#F0F5FF', marginRight: 8 }}
          >
            <Text style={{ fontSize: 13, color: BLUE, fontWeight: '500' }}>
              {allPaused ? '全部恢复' : '全部暂停'}
            </Text>
          </Pressable>
        )}
        {completedTasks.length > 0 && (
          <Pressable onPress={() => clearFinished()} hitSlop={8}>
            <Text style={{ color: '#f5222d', fontSize: 14 }}>清空已完成</Text>
          </Pressable>
        )}
      </View>

      <FlatList
        data={[...activeTasks, ...completedTasks]}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 12, gap: 0, paddingBottom: 24 }}
        ListHeaderComponent={
          hasActive ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, paddingHorizontal: 4 }}>
              <Ionicons name="download-outline" size={16} color={BLUE} />
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#1A1A1A' }}>
                正在下载 ({activeTasks.length})
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          if (item.status === 'pending' || item.status === 'downloading' || item.status === 'paused') {
            return renderActiveItem({ item });
          }
          return renderCompletedItem({ item });
        }}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: 80, gap: 8 }}>
            <Ionicons name="cloud-download-outline" size={56} color="#CCC" />
            <Text style={{ color: '#AAA', fontSize: 15 }}>暂无下载任务</Text>
            <Text style={{ color: '#CCC', fontSize: 12 }}>浏览应用商店，发现喜欢的应用后即可下载</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
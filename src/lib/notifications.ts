/**
 * 下载通知模块
 *
 * 使用 expo-notifications 发送本地通知：
 * - 下载进行中：进度通知（可取消）
 * - 下载完成：可点击打开文件
 * - 下载失败：可点击重试
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { DownloadTask } from './downloadManager';

// 配置通知行为（点击通知时触发）
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const NOTIFICATION_CATEGORY = 'download';
const CHANNEL_ID = 'downloads';

// Android 通知渠道注册
let _channelReady = false;
async function ensureChannel() {
  if (_channelReady) return;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: '下载管理',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 100],
      lightColor: '#1677FF',
      sound: null,
    });
  }
  _channelReady = true;
}

// 跟踪每个任务的通知 ID
const notificationMap = new Map<string, string>();

/** 下载进行中：更新进度通知 */
export async function showDownloadProgress(task: DownloadTask) {
  await ensureChannel();
  const existingId = notificationMap.get(task.id);

  const progressPercent = Math.round(task.progress * 100);
  const speedStr = task.speed > 0
    ? `  ${task.speed < 1024 * 1024 ? `${(task.speed / 1024).toFixed(0)} KB/s` : `${(task.speed / 1024 / 1024).toFixed(1)} MB/s`}`
    : '';

  const identifier = await Notifications.scheduleNotificationAsync({
    identifier: existingId ?? undefined,
    content: {
      title: `正在下载 ${task.appName}`,
      body: `${progressPercent}%${speedStr}${task.multiThreaded ? ' · 多线程' : ''}`,
      data: { taskId: task.id, type: 'download_progress' },
      categoryIdentifier: NOTIFICATION_CATEGORY,
      ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
      autoDismiss: false,
      sticky: false,
      priority: 'default' as const,
    },
    trigger: null,
  });

  if (!existingId) {
    notificationMap.set(task.id, identifier);
  }
}

/** 下载完成 */
export async function showDownloadComplete(task: DownloadTask) {
  await ensureChannel();
  const existingId = notificationMap.get(task.id);
  if (existingId) {
    await Notifications.dismissNotificationAsync(existingId).catch(() => {});
    notificationMap.delete(task.id);
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '下载完成',
      body: `${task.appName}${task.totalBytes > 0 ? ` · ${formatNotifSize(task.totalBytes)}` : ''}`,
      data: { taskId: task.id, type: 'download_complete', localUri: task.localUri },
      categoryIdentifier: NOTIFICATION_CATEGORY,
      ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
      priority: 'default' as const,
      autoDismiss: true,
    },
    trigger: null,
  });
}

/** 下载失败 */
export async function showDownloadFailed(task: DownloadTask) {
  await ensureChannel();
  const existingId = notificationMap.get(task.id);
  if (existingId) {
    await Notifications.dismissNotificationAsync(existingId).catch(() => {});
    notificationMap.delete(task.id);
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '下载失败',
      body: `${task.appName} - ${task.error || '未知错误，请重试'}`,
      data: { taskId: task.id, type: 'download_failed' },
      categoryIdentifier: NOTIFICATION_CATEGORY,
      ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
      priority: 'default' as const,
      autoDismiss: true,
    },
    trigger: null,
  });
}

/** 取消所有下载通知 */
export async function dismissAllDownloadNotifications() {
  for (const [taskId, notifId] of notificationMap) {
    await Notifications.dismissNotificationAsync(notifId).catch(() => {});
  }
  notificationMap.clear();
}

/** 取消特定任务的通知 */
export async function dismissNotification(taskId: string) {
  const notifId = notificationMap.get(taskId);
  if (notifId) {
    await Notifications.dismissNotificationAsync(notifId).catch(() => {});
    notificationMap.delete(taskId);
  }
}

function formatNotifSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/** 获取通知响应监听器，用于处理点击通知事件 */
export function useNotificationResponse(
  onOpenFile: (taskId: string, localUri: string) => void,
  onRetry: (taskId: string) => void,
) {
  return Notifications.useLastNotificationResponse() && (() => {
    const response = Notifications.useLastNotificationResponse();
    React.useEffect(() => {
      if (!response) return;
      const data = response.notification.request.content.data as any;
      if (data?.type === 'download_complete' && data?.localUri) {
        onOpenFile(data.taskId, data.localUri);
      } else if (data?.type === 'download_failed') {
        onRetry(data.taskId);
      }
    }, [response]);
  });
}

import React from 'react';

export function NotificationListener({
  onOpenFile,
  onRetry,
}: {
  onOpenFile: (taskId: string, localUri: string) => void;
  onRetry: (taskId: string) => void;
}) {
  const lastResponse = Notifications.useLastNotificationResponse();
  React.useEffect(() => {
    if (!lastResponse) return;
    const data = lastResponse.notification.request.content.data as any;
    if (data?.type === 'download_complete' && data?.localUri) {
      onOpenFile(data.taskId, data.localUri);
    } else if (data?.type === 'download_failed') {
      onRetry(data.taskId);
    }
  }, [lastResponse]);
  return null;
}
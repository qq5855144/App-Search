/**
 * 系统通知模块
 *
 * 使用 expo-notifications 发送系统通知栏通知：
 * - 下载进行中：进度通知（实时更新）
 * - 下载完成：通知栏弹出
 * - 下载失败：通知栏弹出 + 错误原因
 *
 * 关键：expo-notifications 使用动态 import 懒加载，不在模块顶层加载，
 * 避免原生模块在 app 启动时初始化失败导致闪退。
 */
import { Platform } from 'react-native';

let _Notifications: any = null;
let _notifReady = false;
let _notifInitFailed = false;
const CHANNEL_ID = 'downloads';
const systemNotifMap = new Map<string, string>(); // taskId → notificationId

/** 懒初始化 expo-notifications 原生模块（首次发送通知时调用） */
async function ensureSystemNotif(): Promise<boolean> {
  if (_notifInitFailed) return false;
  if (_notifReady && _Notifications) return true;
  if (Platform.OS === 'web') return false;

  try {
    _Notifications = await import('expo-notifications');
    _Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    if (Platform.OS === 'android') {
      await _Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: '下载管理',
        importance: _Notifications.AndroidImportance?.DEFAULT ?? 3,
        vibrationPattern: [0, 100],
        lightColor: '#1677FF',
        sound: null,
      });
    }
    _notifReady = true;
    return true;
  } catch {
    _notifInitFailed = true;
    return false;
  }
}

/** 系统通知：下载进度 */
export async function showSystemProgress(task: {
  id: string; appName: string; progress: number; speed: number; multiThreaded: boolean;
}): Promise<void> {
  if (!(await ensureSystemNotif())) return;
  try {
    const existingId = systemNotifMap.get(task.id);
    const pct = Math.round(task.progress * 100);
    const speedStr = task.speed > 0
      ? `  ${task.speed < 1024 * 1024 ? `${(task.speed / 1024).toFixed(0)} KB/s` : `${(task.speed / 1024 / 1024).toFixed(1)} MB/s`}`
      : '';
    const identifier = await _Notifications.scheduleNotificationAsync({
      identifier: existingId ?? undefined,
      content: {
        title: `正在下载 ${task.appName}`,
        body: `${pct}%${speedStr}${task.multiThreaded ? ' · 多线程' : ''}`,
        data: { taskId: task.id, type: 'download_progress' },
        ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
        autoDismiss: false,
        sticky: false,
        priority: 'default' as any,
      },
      trigger: null,
    });
    if (!existingId) systemNotifMap.set(task.id, identifier);
  } catch { /* 静默 */ }
}

/** 系统通知：下载完成 */
export async function showSystemComplete(task: {
  id: string; appName: string; totalBytes: number;
}): Promise<void> {
  if (!(await ensureSystemNotif())) return;
  try {
    const existingId = systemNotifMap.get(task.id);
    if (existingId) {
      await _Notifications.dismissNotificationAsync(existingId).catch(() => {});
      systemNotifMap.delete(task.id);
    }
    const sizeStr = task.totalBytes > 0
      ? ` · ${task.totalBytes < 1024 * 1024 ? `${(task.totalBytes / 1024).toFixed(1)} KB` : `${(task.totalBytes / 1024 / 1024).toFixed(1)} MB`}`
      : '';
    await _Notifications.scheduleNotificationAsync({
      content: {
        title: '下载完成',
        body: `${task.appName}${sizeStr}`,
        data: { taskId: task.id, type: 'download_complete' },
        ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
        priority: 'default' as any,
        autoDismiss: true,
      },
      trigger: null,
    });
  } catch { /* 静默 */ }
}

/** 系统通知：下载失败 */
export async function showSystemFailed(task: {
  id: string; appName: string; error: string | null;
}): Promise<void> {
  if (!(await ensureSystemNotif())) return;
  try {
    const existingId = systemNotifMap.get(task.id);
    if (existingId) {
      await _Notifications.dismissNotificationAsync(existingId).catch(() => {});
      systemNotifMap.delete(task.id);
    }
    await _Notifications.scheduleNotificationAsync({
      content: {
        title: '下载失败',
        body: `${task.appName} - ${task.error || '请重试'}`,
        data: { taskId: task.id, type: 'download_failed' },
        ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
        priority: 'default' as any,
        autoDismiss: true,
      },
      trigger: null,
    });
  } catch { /* 静默 */ }
}

/** 系统通知：取消 */
export async function dismissSystemNotification(taskId: string): Promise<void> {
  if (!(await ensureSystemNotif())) return;
  try {
    const notifId = systemNotifMap.get(taskId);
    if (notifId) {
      await _Notifications.dismissNotificationAsync(notifId).catch(() => {});
      systemNotifMap.delete(taskId);
    }
  } catch { /* 静默 */ }
}
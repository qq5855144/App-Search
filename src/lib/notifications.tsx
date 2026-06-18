/**
 * 通知模块（双通道：系统通知 + 应用内横幅）
 *
 * - 系统通知：expo-notifications（动态 import，不在模块顶层加载，避免启动闪退）
 * - 应用内横幅：React Context 纯 JS 实现（系统通知不可用时自动降级）
 *
 * 架构：
 *   NotificationProvider 包裹根组件 → 提供 useNotification() hook
 *   showSystemNotification() 等函数 → 通过动态 import 调用 expo-notifications
 *   DownloadContext 同时调用两者，系统通知失败自动降级横幅
 */
import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { View, Text, Animated, Pressable, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// ─── 类型 ────────────────────────────────────────────────────────────────────
export type NotifType = 'info' | 'success' | 'error' | 'progress';
export interface NotifPayload {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  progress?: number;
  action?: { label: string; onPress: () => void };
  duration?: number;
}

interface NotificationContextValue {
  show: (payload: Omit<NotifPayload, 'id'>) => string;
  update: (id: string, payload: Partial<Omit<NotifPayload, 'id'>>) => void;
  dismiss: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

// ═══════════════════════════════════════════════════════════════════════════════
// React Context Provider（应用内横幅）
// ═══════════════════════════════════════════════════════════════════════════════

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<NotifPayload[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) { clearTimeout(timer); timersRef.current.delete(id); }
    setItems((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const show = useCallback((payload: Omit<NotifPayload, 'id'>): string => {
    const id = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setItems((prev) => [...prev, { ...payload, id }]);
    const dur = payload.duration ?? (payload.type === 'progress' ? 0 : payload.type === 'error' ? 5000 : 3000);
    if (dur > 0) {
      timersRef.current.set(id, setTimeout(() => dismiss(id), dur));
    }
    return id;
  }, [dismiss]);

  const update = useCallback((id: string, payload: Partial<Omit<NotifPayload, 'id'>>) => {
    setItems((prev) => prev.map((n) => n.id === id ? { ...n, ...payload } : n));
  }, []);

  const ctx: NotificationContextValue = { show, update, dismiss };

  return (
    <NotificationContext.Provider value={ctx}>
      {children}
      <View style={styles.container} pointerEvents="box-none">
        {items.map((n) => (
          <NotificationBanner key={n.id} payload={n} onDismiss={() => dismiss(n.id)} />
        ))}
      </View>
    </NotificationContext.Provider>
  );
}

export function useNotification(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotification must be used inside <NotificationProvider>');
  return ctx;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 系统通知（expo-notifications — 动态 import，不在模块顶层加载）
// ═══════════════════════════════════════════════════════════════════════════════

let _Notifications: any = null;
let _notifReady = false;
let _notifInitFailed = false;
const CHANNEL_ID = 'downloads';
const systemNotifMap = new Map<string, string>(); // taskId → notificationId

/** 懒初始化 expo-notifications 原生模块 */
async function ensureSystemNotif(): Promise<boolean> {
  if (_notifInitFailed) return false;
  if (_notifReady && _Notifications) return true;
  if (Platform.OS === 'web') return false;

  try {
    _Notifications = await import('expo-notifications');
    // 设置通知处理（必须在 schedule 之前调用）
    _Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    // Android 通知渠道
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
  } catch { /* 系统通知失败静默忽略 */ }
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

// ═══════════════════════════════════════════════════════════════════════════════
// 横幅组件
// ═══════════════════════════════════════════════════════════════════════════════

function NotificationBanner({ payload, onDismiss }: { payload: NotifPayload; onDismiss: () => void }) {
  const opacity = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }).start();
  }, []);

  const { type, title, body, progress, action } = payload;
  const isProgress = type === 'progress';
  const bgColor = type === 'error' ? '#FFF1F0' : type === 'success' ? '#F6FFED' : '#E6F7FF';
  const borderColor = type === 'error' ? '#FF4D4F' : type === 'success' ? '#52C41A' : '#1677FF';
  const iconName = type === 'error' ? 'alert-circle' : type === 'success' ? 'checkmark-circle' : 'information-circle';

  return (
    <Animated.View style={[styles.banner, { backgroundColor: bgColor, borderLeftColor: borderColor, opacity }]}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, flex: 1 }}>
        <Ionicons name={iconName as any} size={20} color={borderColor} style={{ marginTop: 1 }} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontWeight: '600', fontSize: 14, color: '#1A1A1A' }} numberOfLines={1}>{title}</Text>
          <Text style={{ fontSize: 12, color: '#666' }} numberOfLines={2}>{body}</Text>
          {isProgress && progress !== undefined && (
            <View style={{ height: 3, backgroundColor: '#E5E5E5', borderRadius: 2, marginTop: 4 }}>
              <View style={{ height: 3, backgroundColor: borderColor, borderRadius: 2, width: `${Math.round(progress * 100)}%` as any }} />
            </View>
          )}
          {action && (
            <Pressable onPress={action.onPress} style={{ alignSelf: 'flex-start', marginTop: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: borderColor }}>
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>{action.label}</Text>
            </Pressable>
          )}
        </View>
        <Pressable onPress={onDismiss} hitSlop={8} style={{ padding: 2 }}>
          <Ionicons name="close" size={16} color="#999" />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: 12,
    right: 12,
    zIndex: 9999,
    gap: 8,
  },
  banner: {
    borderRadius: 12,
    borderLeftWidth: 4,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
});
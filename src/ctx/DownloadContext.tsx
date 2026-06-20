/**
 * 全局下载状态 Context
 * 订阅 downloadManager 的所有任务变更，统一向组件树分发
 * 集成通知系统：下载进度/完成/失败通知
 */
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as DM from '@/lib/downloadManager';
import {
  showSystemProgress, showSystemComplete, showSystemFailed,
  dismissSystemNotification, getNotificationPermissionStatus, requestNotificationPermission,
} from '@/lib/notifications';
import { upsertInstalledApp } from '@/lib/database';
import type { DownloadTask } from '@/lib/downloadManager';

interface DownloadContextValue {
  tasks: DownloadTask[];
  enqueue: (params: Parameters<typeof DM.enqueue>[0]) => Promise<string>;
  retry: (oldId: string) => string;
  pause: (id: string) => Promise<void>;
  resume: (id: string) => Promise<void>;
  cancel: (id: string) => Promise<void>;
  deleteFile: (id: string) => Promise<void>;
  clearFinished: () => void;
  clearAllTasks: () => void;
  pauseAll: () => void;
  resumeAll: () => void;
  findByUrl: (url: string) => DownloadTask | undefined;
  activeCount: number;
  safGranted: boolean;
  requestDownloadsPermission: () => Promise<boolean>;
  refreshSafStatus: () => Promise<void>;
}

const DownloadContext = createContext<DownloadContextValue | null>(null);

export function DownloadProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<DownloadTask[]>(() => DM.getAllTasks());
  const [safGranted, setSafGranted] = useState(false);
  const pendingRef = useRef(false);
  const lastNotifState = useRef<Map<string, { status: string; progress: number }>>(new Map());

  useEffect(() => {
    const unsubscribe = DM.subscribe((task) => {
      if (task.id === '__refresh__') {
        setTasks(DM.getAllTasks());
        return;
      }

      // 系统通知
      if (Platform.OS !== 'web') {
        const prev = lastNotifState.current.get(task.id);
        const prevKey = prev ? `${prev.status}_${Math.round(prev.progress * 10)}` : '';
        const currKey = `${task.status}_${Math.round(task.progress * 10)}`;

        if (currKey !== prevKey) {
          lastNotifState.current.set(task.id, { status: task.status, progress: task.progress });

      if (task.status === 'downloading' && task.progress > 0) {
            showSystemProgress({
              id: task.id, appName: task.appName, progress: task.progress,
              speed: task.speed, multiThreaded: false,
            }).catch(() => {});
          } else if (task.status === 'completed') {
            showSystemComplete({ id: task.id, appName: task.appName, totalBytes: task.totalBytes }).catch(() => {});
            // 下载完成时自动写入"已安装"记录
            upsertInstalledApp({
              app_id: task.appId,
              app_name: task.appName,
              owner: task.owner,
              repo: task.repo,
              avatar_url: task.avatarUrl,
              installed_version: task.version,
              installed_at: new Date().toISOString(),
            }).catch(() => {});
          } else if (task.status === 'failed') {
            showSystemFailed({ id: task.id, appName: task.appName, error: task.error }).catch(() => {});
          } else if (task.status === 'cancelled') {
            dismissSystemNotification(task.id).catch(() => {});
          }
        }
      }

      // 防抖更新 UI
      if (pendingRef.current) return;
      pendingRef.current = true;
      setTimeout(() => {
        setTasks(DM.getAllTasks());
        pendingRef.current = false;
      }, 150);
    });

    // 初始化时检查 SAF 权限状态
    if (Platform.OS === 'android') {
      DM.hasDownloadsPermission().then((has) => setSafGranted(has));
    }
    return unsubscribe;
  }, []);

  const refreshSafStatus = async () => {
    if (Platform.OS === 'android') {
      const has = await DM.hasDownloadsPermission();
      setSafGranted(has);
    }
  };

  const activeCount = tasks.filter(
    (t) => t.status === 'pending' || t.status === 'downloading'
  ).length;

  const notifRequestedRef = useRef(false);

  /** 入队：Android 先确保 SAF 权限再开始下载 */
  const enqueueWithSaf = async (params: Parameters<typeof DM.enqueue>[0]): Promise<string> => {
    // Android：若未授权，先弹目录选择器
    if (Platform.OS === 'android' && !safGranted) {
      const granted = await DM.requestDownloadsPermission();
      setSafGranted(granted);
      // 权限被拒也继续（文件降级保存到缓存区，不阻断下载）
    }
    // 首次下载时懒请求通知权限（iOS/Android）
    if (Platform.OS !== 'web' && !notifRequestedRef.current) {
      notifRequestedRef.current = true;
      getNotificationPermissionStatus().then((s) => {
        if (s === 'undetermined') requestNotificationPermission().catch(() => {});
      });
    }
    return DM.enqueue(params);
  };

  const requestDownloadsPermissionAndRefresh = async (): Promise<boolean> => {
    const granted = await DM.requestDownloadsPermission();
    setSafGranted(granted);
    return granted;
  };

  const value: DownloadContextValue = {
    tasks,
    enqueue: enqueueWithSaf,
    retry: (oldId) => {
      const newId = DM.retry(oldId);
      setTasks(DM.getAllTasks());
      return newId;
    },
    pause: DM.pause,
    resume: DM.resume,
    cancel: DM.cancel,
    deleteFile: DM.deleteFile,
    clearFinished: () => {
      DM.clearFinished();
      setTasks(DM.getAllTasks());
    },
    clearAllTasks: () => {
      DM.clearAllTasks();
      setTasks([]);
    },
    pauseAll: () => {
      DM.pauseAll();
      setTasks(DM.getAllTasks());
    },
    resumeAll: () => {
      DM.resumeAll();
      setTasks(DM.getAllTasks());
    },
    findByUrl: DM.findTaskByUrl,
    activeCount,
    safGranted,
    requestDownloadsPermission: requestDownloadsPermissionAndRefresh,
    refreshSafStatus,
  };

  return (
    <DownloadContext.Provider value={value}>
      {children}
    </DownloadContext.Provider>
  );
}

export function useDownload(): DownloadContextValue {
  const ctx = useContext(DownloadContext);
  if (!ctx) throw new Error('useDownload must be used inside <DownloadProvider>');
  return ctx;
}

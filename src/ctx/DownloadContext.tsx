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
import type { DownloadTask } from '@/lib/downloadManager';

interface DownloadContextValue {
  tasks: DownloadTask[];
  enqueue: (params: Parameters<typeof DM.enqueue>[0]) => string;
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
  requestDownloadsPermission: () => Promise<boolean>;
}

const DownloadContext = createContext<DownloadContextValue | null>(null);

export function DownloadProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<DownloadTask[]>(() => DM.getAllTasks());
  const pendingRef = useRef(false);
  const safRequestedRef = useRef(false);
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
              speed: task.speed, multiThreaded: task.multiThreaded,
            }).catch(() => {});
          } else if (task.status === 'completed') {
            showSystemComplete({ id: task.id, appName: task.appName, totalBytes: task.totalBytes }).catch(() => {});
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

    if (Platform.OS === 'android') {
      DM.hasDownloadsPermission().then((has) => { if (has) safRequestedRef.current = true; });
    }
    return unsubscribe;
  }, []);

  const activeCount = tasks.filter(
    (t) => t.status === 'pending' || t.status === 'downloading'
  ).length;

  const notifRequestedRef = useRef(false);

  const enqueueWithSaf = (params: Parameters<typeof DM.enqueue>[0]): string => {
    // Android：首次入队时请求 SAF 目录权限
    if (Platform.OS === 'android' && !safRequestedRef.current) {
      safRequestedRef.current = true;
      DM.requestDownloadsPermission();
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
    requestDownloadsPermission: DM.requestDownloadsPermission,
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

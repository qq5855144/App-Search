/**
 * 全局下载状态 Context
 * 订阅 downloadManager 的所有任务变更，统一向组件树分发
 * 集成通知系统：下载进度/完成/失败通知
 */
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as DM from '@/lib/downloadManager';
import { REFRESH_EVENT } from '@/lib/downloadManager';
import {
  showSystemProgress, showSystemComplete, showSystemFailed,
  dismissSystemNotification, getNotificationPermissionStatus, requestNotificationPermission,
} from '@/lib/notifications';
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
  pauseAll: () => Promise<void>;
  resumeAll: () => void;
  findByUrl: (url: string) => DownloadTask | undefined;
  activeCount: number;
}

const DownloadContext = createContext<DownloadContextValue | null>(null);

export function DownloadProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<DownloadTask[]>(() => DM.getAllTasks());
  const pendingRef = useRef(false);
  const lastNotifState = useRef<Map<string, { status: string; progress: number }>>(new Map());
  const notifRequestedRef = useRef(false);

  useEffect(() => {
    const unsubscribe = DM.subscribe((task) => {
      if ((task as any).id === REFRESH_EVENT) {
        setTasks(DM.getAllTasks());
        return;
      }

      const downloadTask = task as DownloadTask;

      // 系统通知
      if (Platform.OS !== 'web') {
        const prev = lastNotifState.current.get(downloadTask.id);
        const prevKey = prev ? `${prev.status}_${Math.round(prev.progress * 10)}` : '';
        const currKey = `${downloadTask.status}_${Math.round(downloadTask.progress * 10)}`;

        if (currKey !== prevKey) {
          lastNotifState.current.set(downloadTask.id, {
            status: downloadTask.status, progress: downloadTask.progress,
          });
          if (downloadTask.status === 'downloading' && downloadTask.progress > 0) {
            showSystemProgress({
              id: downloadTask.id, appName: downloadTask.appName,
              progress: downloadTask.progress, speed: downloadTask.speed, multiThreaded: false,
            }).catch(() => {});
          } else if (downloadTask.status === 'completed') {
            showSystemComplete({
              id: downloadTask.id, appName: downloadTask.appName, totalBytes: downloadTask.totalBytes,
            }).catch(() => {});
          } else if (downloadTask.status === 'failed') {
            showSystemFailed({
              id: downloadTask.id, appName: downloadTask.appName, error: downloadTask.error,
            }).catch(() => {});
          } else if (downloadTask.status === 'cancelled') {
            dismissSystemNotification(downloadTask.id).catch(() => {});
          }
        }
      }

      // 防抖 150ms 批量更新 UI
      if (pendingRef.current) return;
      pendingRef.current = true;
      setTimeout(() => {
        setTasks(DM.getAllTasks());
        pendingRef.current = false;
      }, 150);
    });

    return unsubscribe;
  }, []);

  /** 入队：首次下载时懒请求通知权限 */
  const enqueueWithNotif = async (params: Parameters<typeof DM.enqueue>[0]): Promise<string> => {
    if (Platform.OS !== 'web' && !notifRequestedRef.current) {
      notifRequestedRef.current = true;
      getNotificationPermissionStatus().then((s) => {
        if (s === 'undetermined') requestNotificationPermission().catch(() => {});
      });
    }
    return DM.enqueue(params);
  };

  const activeCount = tasks.filter(
    (t) => t.status === 'pending' || t.status === 'downloading',
  ).length;

  const value: DownloadContextValue = {
    tasks,
    enqueue: enqueueWithNotif,
    retry: DM.retry,
    pause: DM.pause,
    resume: DM.resume,
    cancel: DM.cancel,
    deleteFile: DM.deleteFile,
    clearFinished: DM.clearFinished,
    clearAllTasks: DM.clearAllTasks,
    pauseAll: DM.pauseAll,
    resumeAll: DM.resumeAll,
    findByUrl: DM.findTaskByUrl,
    activeCount,
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
/**
 * 全局下载状态 Context
 * 订阅 downloadManager 的所有任务变更，统一向组件树分发
 * 集成通知系统：下载进度/完成/失败通知
 */
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as DM from '@/lib/downloadManager';
import { showDownloadProgress, showDownloadComplete, showDownloadFailed, dismissNotification } from '@/lib/notifications';
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
  // 追踪上次通知状态，避免重复通知
  const lastNotifState = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const unsubscribe = DM.subscribe((task) => {
      if (task.id === '__refresh__') {
        setTasks(DM.getAllTasks());
        return;
      }

      // 通知系统：仅在 Native 端发送
      if (Platform.OS !== 'web') {
        const prevState = lastNotifState.current.get(task.id);
        const stateKey = `${task.status}_${Math.round(task.progress * 100)}`;

        if (stateKey !== prevState) {
          lastNotifState.current.set(task.id, stateKey);

          if (task.status === 'downloading' && task.progress > 0) {
            showDownloadProgress(task).catch(() => {});
          } else if (task.status === 'completed') {
            showDownloadComplete(task).catch(() => {});
          } else if (task.status === 'failed') {
            showDownloadFailed(task).catch(() => {});
          } else if (task.status === 'cancelled') {
            dismissNotification(task.id).catch(() => {});
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

  const enqueueWithSaf = (params: Parameters<typeof DM.enqueue>[0]): string => {
    if (Platform.OS === 'android' && !safRequestedRef.current) {
      safRequestedRef.current = true;
      DM.requestDownloadsPermission();
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

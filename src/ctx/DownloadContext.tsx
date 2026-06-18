/**
 * 全局下载状态 Context
 * 订阅 downloadManager 的所有任务变更，统一向组件树分发
 * 集成通知系统：下载进度/完成/失败通知
 */
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as DM from '@/lib/downloadManager';
import { useNotification, showSystemProgress, showSystemComplete, showSystemFailed, dismissSystemNotification } from '@/lib/notifications';
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
  const notif = useNotification();
  // 追踪每个任务的通知 ID 和上次状态
  const notifIdMap = useRef<Map<string, string>>(new Map());
  const lastNotifState = useRef<Map<string, { status: string; progress: number }>>(new Map());

  useEffect(() => {
    const unsubscribe = DM.subscribe((task) => {
      if (task.id === '__refresh__') {
        setTasks(DM.getAllTasks());
        return;
      }

      // 通知系统：系统通知 + 应用内横幅双通道
      if (Platform.OS !== 'web') {
        const prev = lastNotifState.current.get(task.id);
        const prevKey = prev ? `${prev.status}_${Math.round(prev.progress * 10)}` : '';
        const currKey = `${task.status}_${Math.round(task.progress * 10)}`;

        if (currKey !== prevKey) {
          lastNotifState.current.set(task.id, { status: task.status, progress: task.progress });

          if (task.status === 'downloading' && task.progress > 0) {
            // 系统通知：进度条
            showSystemProgress({
              id: task.id, appName: task.appName, progress: task.progress,
              speed: task.speed, multiThreaded: task.multiThreaded,
            }).catch(() => {});
            // 应用内横幅：进度条
            const progressPercent = Math.round(task.progress * 100);
            const existingId = notifIdMap.current.get(task.id);
            if (existingId) {
              notif.update(existingId, {
                title: `正在下载 ${task.appName}`,
                body: `${progressPercent}%${task.speed > 0 ? ` · ${task.speed < 1024 * 1024 ? `${(task.speed / 1024).toFixed(0)} KB/s` : `${(task.speed / 1024 / 1024).toFixed(1)} MB/s`}` : ''}`,
                progress: task.progress,
              });
            } else {
              const nid = notif.show({
                type: 'progress', title: `正在下载 ${task.appName}`,
                body: `${progressPercent}%`, progress: task.progress, duration: 0,
              });
              notifIdMap.current.set(task.id, nid);
            }
          } else if (task.status === 'completed') {
            showSystemComplete({ id: task.id, appName: task.appName, totalBytes: task.totalBytes }).catch(() => {});
            const existingId = notifIdMap.current.get(task.id);
            if (existingId) { notif.dismiss(existingId); notifIdMap.current.delete(task.id); }
            notif.show({ type: 'success', title: '下载完成', body: task.appName, duration: 3000 });
          } else if (task.status === 'failed') {
            showSystemFailed({ id: task.id, appName: task.appName, error: task.error }).catch(() => {});
            const existingId = notifIdMap.current.get(task.id);
            if (existingId) { notif.dismiss(existingId); notifIdMap.current.delete(task.id); }
            notif.show({
              type: 'error', title: '下载失败', body: task.error || '请重试', duration: 5000,
              action: { label: '重试', onPress: () => { DM.retry(task.id); setTasks(DM.getAllTasks()); } },
            });
          } else if (task.status === 'cancelled') {
            dismissSystemNotification(task.id).catch(() => {});
            const existingId = notifIdMap.current.get(task.id);
            if (existingId) { notif.dismiss(existingId); notifIdMap.current.delete(task.id); }
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

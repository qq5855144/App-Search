/**
 * 全局下载状态 Context
 * 订阅 downloadManager 的所有任务变更，统一向组件树分发
 */
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as DM from '@/lib/downloadManager';
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
  findByUrl: (url: string) => DownloadTask | undefined;
  activeCount: number;
  requestDownloadsPermission: () => Promise<boolean>;
}

const DownloadContext = createContext<DownloadContextValue | null>(null);

export function DownloadProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<DownloadTask[]>(() => DM.getAllTasks());
  // 防抖合并 notify，每 200ms 刷新一次防止高频重渲染
  const pendingRef = useRef(false);
  // 是否已请求过 SAF Downloads 权限（本次 App 生命周期内）
  const safRequestedRef = useRef(false);

  useEffect(() => {
    const unsubscribe = DM.subscribe(() => {
      if (pendingRef.current) return;
      pendingRef.current = true;
      setTimeout(() => {
        setTasks(DM.getAllTasks());
        pendingRef.current = false;
      }, 150);
    });
    // App 启动时恢复已有的 SAF 权限缓存（不弹窗，只读 AsyncStorage）
    if (Platform.OS === 'android') {
      DM.hasDownloadsPermission().then((has) => { if (has) safRequestedRef.current = true; });
    }
    return unsubscribe;
  }, []);

  const activeCount = tasks.filter(
    (t) => t.status === 'pending' || t.status === 'downloading'
  ).length;

  /** 第一次在 Android 上触发下载时，自动弹出 SAF 目录授权对话框 */
  const enqueueWithSaf = (params: Parameters<typeof DM.enqueue>[0]): string => {
    if (Platform.OS === 'android' && !safRequestedRef.current) {
      safRequestedRef.current = true;
      DM.requestDownloadsPermission(); // 不 await，弹窗在后台处理
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

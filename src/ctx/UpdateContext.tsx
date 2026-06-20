/**
 * UpdateContext
 * 管理"已安装应用"的更新检查状态：
 * - App 启动时自动检查一次更新
 * - 提供 pendingCount（待更新数量）给首页角标使用
 * - 提供 recheckAll() 供下载管理页手动触发
 */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  getInstalledApps, updateInstalledLatest, type InstalledApp,
} from '@/lib/database';
import { fetchReleases } from '@/lib/github';

interface UpdateContextValue {
  /** 有可用更新且未忽略的应用数量 */
  pendingCount: number;
  /** 正在检查更新 */
  checking: boolean;
  /** 手动触发全量检查（忽略 last_checked 缓存） */
  recheckAll: () => Promise<void>;
  /** 通知 context 某个 app 的 ignored_version 已更新，刷新 pendingCount */
  refresh: () => Promise<void>;
}

const UpdateContext = createContext<UpdateContextValue | null>(null);

/** 同一个 owner/repo 1 小时内不重复请求 */
const CHECK_INTERVAL_MS = 60 * 60 * 1000;
/** 并发检查上限，避免 GitHub API 429 */
const CONCURRENCY = 4;

function hasPendingUpdate(app: InstalledApp): boolean {
  const { latest_version, installed_version, ignored_version } = app;
  if (!latest_version) return false;
  if (latest_version === installed_version) return false;
  if (ignored_version && latest_version === ignored_version) return false;
  return true;
}

export function UpdateProvider({ children }: { children: React.ReactNode }) {
  const [pendingCount, setPendingCount] = useState(0);
  const [checking, setChecking] = useState(false);
  const runningRef = useRef(false);

  /** 计算并更新 pendingCount（纯读 DB） */
  const refresh = useCallback(async () => {
    try {
      const list = await getInstalledApps();
      setPendingCount(list.filter(hasPendingUpdate).length);
    } catch { /* ignore */ }
  }, []);

  /**
   * 批量检查更新
   * @param force 是否忽略 last_checked 缓存
   */
  const checkAll = useCallback(async (force = false) => {
    if (runningRef.current) return;
    runningRef.current = true;
    setChecking(true);
    try {
      const list = await getInstalledApps();
      if (!list.length) return;

      const now = Date.now();
      const toCheck = force
        ? list
        : list.filter((a) => {
            if (!a.last_checked) return true;
            return now - new Date(a.last_checked).getTime() > CHECK_INTERVAL_MS;
          });

      // 分批并发
      for (let i = 0; i < toCheck.length; i += CONCURRENCY) {
        const batch = toCheck.slice(i, i + CONCURRENCY);
        await Promise.all(
          batch.map(async (app) => {
            try {
              const releases = await fetchReleases(app.owner, app.repo, 1);
              if (releases.length > 0) {
                await updateInstalledLatest(app.app_id, releases[0].tag_name);
              }
            } catch { /* 单个检查失败不影响其他 */ }
          }),
        );
      }

      await refresh();
    } finally {
      setChecking(false);
      runningRef.current = false;
    }
  }, [refresh]);

  const recheckAll = useCallback(() => checkAll(true), [checkAll]);

  // App 启动时自动检查一次
  useEffect(() => {
    checkAll(false);
  }, []);

  return (
    <UpdateContext.Provider value={{ pendingCount, checking, recheckAll, refresh }}>
      {children}
    </UpdateContext.Provider>
  );
}

export function useUpdate(): UpdateContextValue {
  const ctx = useContext(UpdateContext);
  if (!ctx) throw new Error('useUpdate must be inside <UpdateProvider>');
  return ctx;
}

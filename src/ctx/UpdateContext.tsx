/**
 * UpdateContext v2 — 健壮的已安装应用更新检测
 *
 * 核心改进：
 * 1. 使用轻量级 fetchLatestReleaseTag（仅获取 tag_name，不拉取完整 assets）
 * 2. 版本号规范化（统一去除 v/V 前缀） + SemVer 比较
 * 3. 速率限制感知：遇到 429/403 时优雅降级，等待 1 分钟后重试
 * 4. App 启动时全量检查 + 切回前台时增量检查（距上次检查超过 1h 的）
 * 5. 下载完成时自动记录到 installed_apps，触发更新检查
 */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import {
  getInstalledApps, upsertInstalledApp, updateInstalledLatest,
  type InstalledApp,
} from '@/lib/database';
import { fetchLatestReleaseTag, normalizeVersion, isVersionOlder } from '@/lib/github';
import * as DM from '@/lib/downloadManager';

interface UpdateContextValue {
  /** 有可用更新且未忽略的应用数量 */
  pendingCount: number;
  /** 正在检查更新 */
  checking: boolean;
  /** 批量检查所有已安装应用的更新 */
  checkAll: (force?: boolean) => Promise<void>;
  /** 刷新 pendingCount（纯读 DB） */
  refresh: () => Promise<void>;
  /** 检查单个应用的更新（原子操作，不触发全量刷新） */
  checkSingle: (owner: string, repo: string, appId: number) => Promise<string | null>;
}

const UpdateContext = createContext<UpdateContextValue | null>(null);

/** 距上次检查超过该时间才重新检查 */
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1h
/** 并发检查上限，避免 GitHub API 429 */
const CONCURRENCY = 4;
/** 速率限制后退避时间 */
const RATE_LIMIT_BACKOFF_MS = 60 * 1000; // 1min

/**
 * 判断应用是否有可用更新（未忽略且语义版本号更高）
 * 使用 normalizeVersion + isVersionOlder 而非字符串等号
 */
function hasPendingUpdate(app: InstalledApp): boolean {
  const { latest_version, installed_version, ignored_version } = app;
  if (!latest_version || !installed_version) return false;

  const nl = normalizeVersion(latest_version);
  const ni = normalizeVersion(installed_version);
  if (!nl || !ni) return false;

  // 版本号相同 → 无更新
  if (nl === ni) return false;
  // 已忽略该版本 → 不提示
  if (ignored_version && normalizeVersion(ignored_version) === nl) return false;
  // 只有远程版本号严格大于本地版本号才提示更新
  return isVersionOlder(ni, nl);
}

export function UpdateProvider({ children }: { children: React.ReactNode }) {
  const [pendingCount, setPendingCount] = useState(0);
  const [checking, setChecking] = useState(false);
  const runningRef = useRef(false);
  const rateLimitedRef = useRef(false);
  const rateLimitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appStateRef = useRef<AppStateStatus>('active');

  /** 从 DB 重新计算 pendingCount */
  const refresh = useCallback(async () => {
    try {
      const list = await getInstalledApps();
      setPendingCount(list.filter(hasPendingUpdate).length);
    } catch { /* ignore */ }
  }, []);

  /** 检查单个应用的更新（返回最新 tag_name 或 null） */
  const checkSingle = useCallback(async (
    owner: string,
    repo: string,
    appId: number,
  ): Promise<string | null> => {
    try {
      // 速率限制退避
      if (rateLimitedRef.current) return null;

      const tag = await fetchLatestReleaseTag(owner, repo, true);
      if (tag) {
        await updateInstalledLatest(appId, tag);
        return tag;
      }
      return null;
    } catch (e: any) {
      const msg = e?.message || '';
      if (msg.includes('403') || msg.includes('429') || msg.includes('rate limit')) {
        // 触发退避
        rateLimitedRef.current = true;
        if (rateLimitTimerRef.current) clearTimeout(rateLimitTimerRef.current);
        rateLimitTimerRef.current = setTimeout(() => {
          rateLimitedRef.current = false;
        }, RATE_LIMIT_BACKOFF_MS);
      }
      return null;
    }
  }, []);

  /**
   * 批量检查所有已安装应用的更新
   * @param force 是否忽略 last_checked 缓存
   */
  const checkAll = useCallback(async (force = false) => {
    if (runningRef.current) return;
    if (rateLimitedRef.current) return; // 速率限制退避中

    runningRef.current = true;
    setChecking(true);
    try {
      const list = await getInstalledApps();
      if (!list.length) return;

      const now = Date.now();
      // 筛选需要检查的应用：从未检查过 或 超过 1h 未检查
      const toCheck = force
        ? list
        : list.filter((a) => {
            if (!a.last_checked) return true;
            return now - new Date(a.last_checked).getTime() > CHECK_INTERVAL_MS;
          });

      if (toCheck.length === 0) return;

      // 分批并发，每批之间间隔 200ms 避免触发短期速率限制
      for (let i = 0; i < toCheck.length; i += CONCURRENCY) {
        const batch = toCheck.slice(i, i + CONCURRENCY);
        const results = await Promise.allSettled(
          batch.map((app) =>
            fetchLatestReleaseTag(app.owner, app.repo, true).then((tag) => {
              if (tag) {
                return updateInstalledLatest(app.app_id, tag).catch(() => {});
              }
            }),
          ),
        );
        // 检测是否有速率限制的错误
        for (const r of results) {
          if (r.status === 'rejected') {
            const msg = (r.reason as any)?.message || '';
            if (msg.includes('403') || msg.includes('429') || msg.includes('rate limit')) {
              rateLimitedRef.current = true;
              if (rateLimitTimerRef.current) clearTimeout(rateLimitTimerRef.current);
              rateLimitTimerRef.current = setTimeout(() => {
                rateLimitedRef.current = false;
              }, RATE_LIMIT_BACKOFF_MS);
              // 停止后续批次
              break;
            }
          }
        }
        if (rateLimitedRef.current) break;
        // 批次间间隔
        if (i + CONCURRENCY < toCheck.length) {
          await new Promise((r) => setTimeout(r, 200));
        }
      }

      await refresh();
    } finally {
      setChecking(false);
      runningRef.current = false;
    }
  }, [refresh]);

  // App 启动时强制全量检查
  useEffect(() => {
    checkAll(true);
  }, []);

  // App 切回前台时增量检查
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        checkAll(false);
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, [checkAll]);

  // 监听下载完成 → 自动记录 installed_apps + 触发检测
  useEffect(() => {
    const unsub = DM.subscribe((task) => {
      if (task.status === 'completed' && task.appId > 0) {
        (async () => {
          try {
            // 记录为已安装
            await upsertInstalledApp({
              app_id: task.appId,
              app_name: task.appName,
              owner: task.owner,
              repo: task.repo,
              avatar_url: task.avatarUrl,
              installed_version: task.version,
              installed_at: new Date().toISOString(),
            });
            // 检查最新版本
            const latest = await fetchLatestReleaseTag(task.owner, task.repo, true);
            if (latest) {
              await updateInstalledLatest(task.appId, latest);
            }
            await refresh();
          } catch { /* ignore */ }
        })();
      }
    });
    return unsub;
  }, [refresh]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (rateLimitTimerRef.current) clearTimeout(rateLimitTimerRef.current);
    };
  }, []);

  return (
    <UpdateContext.Provider value={{ pendingCount, checking, checkAll, refresh, checkSingle }}>
      {children}
    </UpdateContext.Provider>
  );
}

export function useUpdate(): UpdateContextValue {
  const ctx = useContext(UpdateContext);
  if (!ctx) throw new Error('useUpdate must be inside <UpdateProvider>');
  return ctx;
}
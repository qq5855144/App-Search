/**
 * 下载管理器 v26 — 系统下载器架构
 *
 * 核心原则：调用系统级下载引擎，不自己实现 HTTP 客户端
 *
 * 引擎：
 *  - Android : react-native-blob-util + addAndroidDownloads
 *             → 系统 DownloadManager 接管下载
 *             → 文件直存 /storage/emulated/0/Download/
 *             → 系统通知栏显示进度，应用内进度回调同步更新
 *  - iOS     : expo-file-system createDownloadResumable
 *             → 底层 NSURLSession（系统级 HTTP 引擎）
 *             → 文件存 documentDirectory/dl_perm/
 *  - Web     : window.open() 交给浏览器
 *
 * 设计要点：
 *  - Android 使用系统 DownloadManager，彻底绕开 OkHttp HTTP/2 RST_STREAM 问题
 *  - 下载完成后文件已在公共 Downloads 目录，安装器可直接访问
 *  - 不跳转浏览器，全程应用内下载
 *  - 暂停/恢复：Android 不支持（系统 DownloadManager 不支持断点续传），iOS 保留 resumeData
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ReactNativeBlobUtil from 'react-native-blob-util';
import * as _FileSystem from 'expo-file-system/legacy';

const IS_WEB = Platform.OS === 'web';
const IS_ANDROID = Platform.OS === 'android';
const IS_IOS = Platform.OS === 'ios';
const MAX_CONCURRENT = 3;
const PERM_DIR_NAME = 'dl_perm';
const RESUME_KEY_PREFIX = '@openappstore/resume_';

// ─── 工具函数 ─────────────────────────────────────────────────────────────────
export function getMimeType(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.apk'))  return 'application/vnd.android.package-archive';
  if (lower.endsWith('.ipa') || lower.endsWith('.pkg')) return 'application/octet-stream';
  if (lower.endsWith('.exe'))  return 'application/vnd.microsoft.portable-executable';
  if (lower.endsWith('.msi'))  return 'application/x-msi';
  if (lower.endsWith('.dmg'))  return 'application/x-apple-diskimage';
  if (lower.endsWith('.deb'))  return 'application/vnd.debian.binary-package';
  if (lower.endsWith('.rpm'))  return 'application/x-rpm';
  if (lower.endsWith('.zip'))  return 'application/zip';
  if (lower.endsWith('.tar.gz') || lower.endsWith('.tgz')) return 'application/gzip';
  return 'application/octet-stream';
}

export function isInstallerFile(filename: string): boolean {
  return ['.apk', '.ipa', '.exe', '.msi', '.dmg', '.pkg', '.deb', '.rpm', '.appimage']
    .some((e) => filename.toLowerCase().endsWith(e));
}

export function formatSpeed(bytesPerSec: number): string {
  if (!bytesPerSec || bytesPerSec <= 0) return '';
  if (bytesPerSec < 1024) return `${bytesPerSec} B/s`;
  if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
  return `${(bytesPerSec / 1024 / 1024).toFixed(2)} MB/s`;
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

// ─── 类型定义 ─────────────────────────────────────────────────────────────────
export type DownloadStatus = 'pending' | 'downloading' | 'paused' | 'completed' | 'failed' | 'cancelled';

export interface DownloadTask {
  id: string;
  url: string;
  filename: string;
  appId: number;
  appName: string;
  owner: string;
  repo: string;
  avatarUrl: string;
  version: string;
  status: DownloadStatus;
  progress: number;
  bytesWritten: number;
  totalBytes: number;
  speed: number;
  eta: number;
  localUri: string | null;
  error: string | null;
  createdAt: number;
}

export const REFRESH_EVENT = Symbol('download_refresh');

type ProgressCallback = (task: DownloadTask | { id: typeof REFRESH_EVENT }) => void;

// ─── 全局状态 ─────────────────────────────────────────────────────────────────
const tasks = new Map<string, DownloadTask>();
const subscribers = new Set<ProgressCallback>();
/** 活跃的下载会话（Android: ReactNativeBlobUtil session, iOS: DownloadResumable） */
const activeSessions = new Map<string, any>();
const speedSampler = new Map<string, { ts: number; bytes: number }>();

function genId(): string { return `dl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`; }
function notify(task: DownloadTask) { subscribers.forEach((cb) => cb({ ...task })); }
function notifyRefresh() { subscribers.forEach((cb) => cb({ id: REFRESH_EVENT })); }

function flushQueue() {
  const active = [...tasks.values()].filter((t) => t.status === 'downloading').length;
  if (active >= MAX_CONCURRENT) return;
  const next = [...tasks.values()].find((t) => t.status === 'pending');
  if (next) startTask(next.id);
}

function mapErrorMessage(msg: string): string {
  if (!msg) return '下载失败，请重试';
  if (msg.includes('Network request failed') || msg.includes('Unable to resolve host'))
    return '网络连接失败，请检查网络后重试';
  if (msg.includes('No space left') || msg.includes('ENOSPC'))
    return '存储空间不足，请清理后重试';
  if (msg.includes('403') || msg.includes('Forbidden'))
    return '下载链接已失效（403）';
  if (msg.includes('404') || msg.includes('Not Found'))
    return '文件不存在（404），该版本可能已删除';
  if (msg.includes('timeout') || msg.includes('ETIMEDOUT') || msg.includes('read timed out'))
    return '下载超时，请检查网络后重试';
  if (msg.includes('ECONNRESET') || msg.includes('ECONNREFUSED'))
    return '连接被重置，请检查网络后重试';
  if (msg.includes('ENOTFOUND') || msg.includes('DNS'))
    return 'DNS 解析失败，请检查网络连接';
  if (msg.includes('Download interrupted') || msg.includes('IOException'))
    return '下载连接中断，请检查网络后重试';
  if (msg.includes('503') || msg.includes('429') || msg.includes('Too Many Requests'))
    return '服务器繁忙，请稍后重试';
  return msg;
}

// ─── 进度更新 ─────────────────────────────────────────────────────────────────

function applyProgress(id: string, bytesWritten: number, totalBytes: number) {
  const t = tasks.get(id);
  if (!t || t.status !== 'downloading') return;
  const now = Date.now();
  const prev = speedSampler.get(id) ?? { ts: now, bytes: 0 };
  const elapsed = (now - prev.ts) / 1000;
  let speed = t.speed;
  if (elapsed >= 0.5) {
    speed = Math.max(0, Math.round((bytesWritten - prev.bytes) / elapsed));
    speedSampler.set(id, { ts: now, bytes: bytesWritten });
  }
  t.bytesWritten = bytesWritten;
  if (totalBytes > 0) t.totalBytes = totalBytes;
  t.progress = t.totalBytes > 0 ? bytesWritten / t.totalBytes : -1;
  t.speed = speed;
  t.eta = speed > 0 && t.totalBytes > 0 ? Math.round((t.totalBytes - bytesWritten) / speed) : -1;
  notify(t);
}

// ─── Android：系统 DownloadManager ────────────────────────────────────────────

async function startTaskAndroid(id: string) {
  const task = tasks.get(id);
  if (!task) return;
  if (activeSessions.has(id)) return;

  task.status = 'downloading';
  task.error = null;
  task.speed = 0;
  task.eta = -1;
  task.progress = 0;
  task.bytesWritten = 0;
  task.totalBytes = 0;
  notify(task);

  // 文件直接存到公共 Downloads 目录
  const downloadPath = `${ReactNativeBlobUtil.fs.dirs.DownloadDir}/${task.filename}`;

  // 删除可能存在的旧文件
  await ReactNativeBlobUtil.fs.unlink(downloadPath).catch(() => null);

  const session = ReactNativeBlobUtil.config({
    addAndroidDownloads: {
      useDownloadManager: true,
      notification: true,
      path: downloadPath,
      mime: getMimeType(task.filename),
      title: task.appName,
      description: `正在下载 ${task.filename}`,
      mediaScannable: true,
    },
  })
    .fetch('GET', task.url, {
      'User-Agent': 'OpenAppStore/1.0',
    })
    .progress({ count: 10, interval: 250 }, (received: number, total: number) => {
      applyProgress(id, Number(received), Number(total));
    });

  activeSessions.set(id, session);

  try {
    const res = await session;
    activeSessions.delete(id);
    speedSampler.delete(id);

    const t = tasks.get(id);
    if (!t) return;

    const filePath = res.path();
    if (!filePath) {
      t.status = 'failed';
      t.error = '下载完成但文件路径丢失';
      notify(t);
      flushQueue();
      return;
    }

    // 验证文件存在且非空
    const exists = await ReactNativeBlobUtil.fs.exists(filePath);
    const stat = exists ? await ReactNativeBlobUtil.fs.stat(filePath).catch(() => null) : null;
    if (!stat || stat.size === 0) {
      t.status = 'failed';
      t.error = '下载文件大小为 0';
      notify(t);
      flushQueue();
      return;
    }

    t.status = 'completed';
    t.progress = 1;
    t.speed = 0;
    t.eta = 0;
    t.bytesWritten = stat.size;
    t.totalBytes = stat.size;
    t.localUri = `file://${filePath}`;
    t.error = null;
    notify(t);
    flushQueue();
  } catch (e: any) {
    activeSessions.delete(id);
    speedSampler.delete(id);

    const t = tasks.get(id);
    if (!t) { flushQueue(); return; }

    // pause/cancel 已将 status 置为 paused/cancelled，不覆盖
    if (t.status !== 'downloading') { flushQueue(); return; }

    t.status = 'failed';
    t.error = mapErrorMessage(e?.message ?? '');
    notify(t);
    flushQueue();
  }
}

// ─── iOS：expo-file-system (NSURLSession) ─────────────────────────────────────

async function startTaskIOS(id: string) {
  const task = tasks.get(id);
  if (!task) return;
  if (activeSessions.has(id)) return;

  const fs = _FileSystem;
  const tempDir = `${fs.documentDirectory ?? ''}dl_${id}/`;
  const localUri = `${tempDir}${task.filename}`;
  const resumeKey = `${RESUME_KEY_PREFIX}${task.url.replace(/[^a-zA-Z0-9]/g, '_').slice(-100)}`;

  await fs.makeDirectoryAsync(tempDir, { intermediates: true }).catch(() => null);

  // 加载断点续传数据
  let resumeData: string | undefined;
  try {
    const saved = await AsyncStorage.getItem(resumeKey);
    if (saved) {
      const info = await fs.getInfoAsync(localUri).catch(() => ({ exists: false }));
      if (info.exists) {
        resumeData = saved;
      } else {
        await AsyncStorage.removeItem(resumeKey).catch(() => null);
      }
    }
  } catch { /* ignore */ }

  task.status = 'downloading';
  task.error = null;
  task.speed = 0;
  task.eta = -1;
  if (!resumeData) {
    task.progress = 0;
    task.bytesWritten = 0;
    task.totalBytes = 0;
  }
  notify(task);

  let resumableRef: _FileSystem.DownloadResumable | null = null;
  let lastSaveTs = 0;

  const resumable = fs.createDownloadResumable(
    task.url,
    localUri,
    { headers: { 'User-Agent': 'OpenAppStore/1.0' } },
    (dp: { totalBytesWritten: number; totalBytesExpectedToWrite: number }) => {
      applyProgress(id, dp.totalBytesWritten, dp.totalBytesExpectedToWrite);
      const now = Date.now();
      const isFirst = lastSaveTs === 0 && dp.totalBytesWritten > 0;
      if ((isFirst || now - lastSaveTs > 3_000) && resumableRef) {
        lastSaveTs = now;
        try {
          const state = resumableRef.savable();
          if (state.resumeData) {
            AsyncStorage.setItem(resumeKey, JSON.stringify(state.resumeData)).catch(() => null);
          }
        } catch { /* ignore */ }
      }
    },
    resumeData ? JSON.parse(resumeData) : undefined,
  );
  resumableRef = resumable;
  activeSessions.set(id, resumable);

  try {
    const result = await resumable.downloadAsync();
    activeSessions.delete(id);
    speedSampler.delete(id);
    resumableRef = null;
    await AsyncStorage.removeItem(resumeKey).catch(() => null);

    const t = tasks.get(id);
    if (!t) return;

    if (!result) {
      // result 为 null = 被外部取消（pause/cancel）
      if (t.status === 'downloading') {
        t.status = 'failed';
        t.error = '下载中断，请重试';
        notify(t);
      }
      flushQueue();
      return;
    }

    // 验证文件非空
    const info = await fs.getInfoAsync(result.uri).catch(() => ({ exists: false }));
    const actualSize: number = info.exists ? ((info as any).size ?? 0) : 0;
    if (actualSize === 0) {
      t.status = 'failed';
      t.error = '下载文件大小为 0，请重试';
      notify(t);
      await fs.deleteAsync(tempDir, { idempotent: true }).catch(() => null);
      flushQueue();
      return;
    }

    // 移入持久目录
    const permDir = `${fs.documentDirectory ?? ''}${PERM_DIR_NAME}/`;
    await fs.makeDirectoryAsync(permDir, { intermediates: true }).catch(() => null);
    const destUri = `${permDir}${t.filename}`;
    await fs.deleteAsync(destUri, { idempotent: true }).catch(() => null);
    try {
      await fs.moveAsync({ from: result.uri, to: destUri });
      t.localUri = destUri;
      await fs.deleteAsync(tempDir, { idempotent: true }).catch(() => null);
    } catch {
      t.localUri = result.uri;
    }

    t.status = 'completed';
    t.progress = 1;
    t.speed = 0;
    t.eta = 0;
    t.bytesWritten = actualSize;
    t.totalBytes = actualSize;
    t.error = null;
    notify(t);
    flushQueue();
  } catch (e: any) {
    activeSessions.delete(id);
    speedSampler.delete(id);
    resumableRef = null;

    const t = tasks.get(id);
    if (!t) { flushQueue(); return; }

    if (t.status !== 'downloading') { flushQueue(); return; }

    t.status = 'failed';
    t.error = mapErrorMessage(e?.message ?? '');
    notify(t);
    await AsyncStorage.removeItem(resumeKey).catch(() => null);
    await fs.deleteAsync(tempDir, { idempotent: true }).catch(() => null);
    flushQueue();
  }
}

// ─── 统一入口 ─────────────────────────────────────────────────────────────────

async function startTask(id: string) {
  const task = tasks.get(id);
  if (!task) return;

  if (IS_WEB) {
    task.status = 'completed';
    task.progress = 1;
    task.localUri = task.url;
    if (typeof window !== 'undefined') window.open(task.url, '_blank');
    notify(task);
    flushQueue();
    return;
  }

  if (IS_ANDROID) {
    return startTaskAndroid(id);
  }

  // iOS
  const fs = _FileSystem;
  if (!fs) {
    task.status = 'failed';
    task.error = '文件系统不可用';
    notify(task);
    flushQueue();
    return;
  }
  return startTaskIOS(id);
}

// ─── 公开 API ─────────────────────────────────────────────────────────────────

export function subscribe(cb: ProgressCallback): () => void {
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}

export function getAllTasks(): DownloadTask[] {
  return [...tasks.values()].sort((a, b) => b.createdAt - a.createdAt);
}

export function getTask(id: string): DownloadTask | undefined { return tasks.get(id); }

export function findTaskByUrl(url: string): DownloadTask | undefined {
  if (!url) return undefined;
  return [...tasks.values()].find((t) => t.url === url);
}

export function enqueue(params: {
  url: string; filename: string; appId: number; appName: string;
  owner: string; repo: string; avatarUrl: string; version: string;
}): string {
  if (!params.url || typeof params.url !== 'string' || !params.url.startsWith('http')) {
    throw new Error('下载链接无效');
  }
  const existing = findTaskByUrl(params.url);
  if (existing && ['pending', 'downloading', 'paused', 'completed'].includes(existing.status)) {
    return existing.id;
  }
  if (existing) {
    tasks.delete(existing.id);
  }

  const id = genId();
  const task: DownloadTask = {
    id, ...params,
    status: 'pending', progress: 0, bytesWritten: 0, totalBytes: 0,
    speed: 0, eta: -1, localUri: null, error: null, createdAt: Date.now(),
  };
  tasks.set(id, task);
  notify(task);
  flushQueue();
  return id;
}

export function retry(oldId: string): string {
  const old = tasks.get(oldId);
  if (!old) return '';

  tasks.delete(oldId);

  const newId = genId();
  const task: DownloadTask = {
    id: newId,
    url: old.url, filename: old.filename, appId: old.appId, appName: old.appName,
    owner: old.owner, repo: old.repo, avatarUrl: old.avatarUrl, version: old.version,
    status: 'pending', progress: 0, bytesWritten: 0, totalBytes: 0,
    speed: 0, eta: -1, localUri: null, error: null, createdAt: Date.now(),
  };
  tasks.set(newId, task);
  notify(task);
  flushQueue();
  return newId;
}

export async function pause(id: string): Promise<void> {
  const task = tasks.get(id);
  if (!task || task.status !== 'downloading') return;

  if (IS_IOS) {
    const session = activeSessions.get(id);
    if (session) {
      try {
        const state = session.savable();
        const resumeKey = `${RESUME_KEY_PREFIX}${task.url.replace(/[^a-zA-Z0-9]/g, '_').slice(-100)}`;
        if (state.resumeData) {
          await AsyncStorage.setItem(resumeKey, JSON.stringify(state.resumeData)).catch(() => null);
        }
      } catch { /* ignore */ }
      session.cancelAsync?.().catch(() => {});
      activeSessions.delete(id);
    }
  } else if (IS_ANDROID) {
    // Android DownloadManager 不支持暂停，取消下载
    const session = activeSessions.get(id);
    if (session) {
      session.cancel?.().catch(() => {});
      activeSessions.delete(id);
    }
  }

  task.status = 'paused';
  task.speed = 0;
  task.eta = -1;
  speedSampler.delete(id);
  notify(task);
}

export async function resume(id: string): Promise<void> {
  const task = tasks.get(id);
  if (!task || task.status !== 'paused') return;
  task.status = 'pending';
  task.error = null;
  notify(task);
  flushQueue();
}

export async function cancel(id: string): Promise<void> {
  const task = tasks.get(id);
  if (!task) return;

  const session = activeSessions.get(id);
  if (session) {
    if (IS_IOS) {
      session.cancelAsync?.().catch(() => {});
    } else {
      session.cancel?.().catch(() => {});
    }
    activeSessions.delete(id);
  }

  task.status = 'cancelled';
  speedSampler.delete(id);
  notify(task);
  tasks.delete(id);
  flushQueue();
}

export async function deleteFile(id: string): Promise<void> {
  const task = tasks.get(id);
  if (!task) return;

  if (['downloading', 'pending'].includes(task.status)) {
    await cancel(id);
    notifyRefresh();
    return;
  }

  if (!IS_WEB && task.localUri) {
    if (IS_ANDROID) {
      // Android: 文件在公共 Downloads 目录
      const filePath = task.localUri.replace('file://', '');
      await ReactNativeBlobUtil.fs.unlink(filePath).catch(() => null);
    } else if (IS_IOS) {
      const fs = _FileSystem;
      if (fs) {
        await fs.deleteAsync(task.localUri, { idempotent: true }).catch(() => null);
      }
    }
  }

  tasks.delete(id);
  speedSampler.delete(id);
  notifyRefresh();
}

export function clearFinished(): void {
  for (const [id, task] of tasks.entries()) {
    if (['completed', 'failed', 'cancelled'].includes(task.status)) {
      // fire-and-forget 清理磁盘文件
      if (!IS_WEB && task.localUri) {
        if (IS_ANDROID) {
          const filePath = task.localUri.replace('file://', '');
          ReactNativeBlobUtil.fs.unlink(filePath).catch(() => null);
        } else if (IS_IOS) {
          const fs = _FileSystem;
          if (fs) {
            fs.deleteAsync(task.localUri, { idempotent: true }).catch(() => null);
          }
        }
      }
      tasks.delete(id);
      speedSampler.delete(id);
    }
  }
  notifyRefresh();
}

export async function pauseAll(): Promise<void> {
  for (const [id, task] of tasks) {
    if (task.status === 'downloading' || task.status === 'pending') {
      const session = activeSessions.get(id);
      if (session) {
        if (IS_IOS) {
          try {
            const state = session.savable();
            const resumeKey = `${RESUME_KEY_PREFIX}${task.url.replace(/[^a-zA-Z0-9]/g, '_').slice(-100)}`;
            if (state.resumeData) {
              AsyncStorage.setItem(resumeKey, JSON.stringify(state.resumeData)).catch(() => null);
            }
          } catch { /* ignore */ }
          session.cancelAsync?.().catch(() => {});
        } else {
          session.cancel?.().catch(() => {});
        }
        activeSessions.delete(id);
      }
      task.status = 'paused';
      task.speed = 0;
      task.eta = -1;
      speedSampler.delete(id);
      notify(task);
    }
  }
}

export function resumeAll(): void {
  for (const [, task] of tasks) {
    if (task.status === 'paused') {
      task.status = 'pending';
      task.error = null;
      notify(task);
    }
  }
  flushQueue();
}

export function clearAllTasks(): void {
  for (const [id] of tasks.entries()) {
    const session = activeSessions.get(id);
    if (session) {
      if (IS_IOS) {
        session.cancelAsync?.().catch(() => {});
      } else {
        session.cancel?.().catch(() => {});
      }
      activeSessions.delete(id);
    }
  }
  tasks.clear();
  speedSampler.clear();
  notifyRefresh();
}
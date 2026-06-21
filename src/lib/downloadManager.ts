/**
 * 下载管理器 v6 — 健壮性增强版
 *
 * 设计决策：
 * 1. 直接下载：不做 HEAD URL 解析（GitHub 302 由 Android 原生 HTTP 客户端透明跟随）
 * 2. 单线程：移除分片并行（大文件 Base64 合并导致 OOM，且收益有限）
 * 3. 暂停续传：pauseAsync() 保存 resumeData，resume 时带 resumeData 重建 Resumable
 * 4. 进度回调：移除节流门，每次回调都 notify，由 Context 防抖 150ms 控制渲染频率
 * 5. SAF 保存：Android 完成后写入公共 Downloads（静态导入 expo-file-system/legacy）
 * 6. 大文件保护：SAF 移动前检查文件大小，超过 50MB 跳过 Base64 转换避免 OOM
 * 7. 自动重试：临时网络错误自动重试 1 次
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as _FileSystem from 'expo-file-system/legacy';

const IS_WEB = Platform.OS === 'web';
const SAF_URI_KEY = '@openappstore/saf_downloads_uri';
const MAX_CONCURRENT = 3;
/** SAF Base64 移动的最大文件大小（50MB），超过则保留在缓存目录避免 OOM */
const SAF_BASE64_MAX_SIZE = 50 * 1024 * 1024;
/** 自动重试次数 */
const MAX_AUTO_RETRY = 1;

function getFS(): typeof _FileSystem | null {
  return IS_WEB ? null : _FileSystem;
}

// ─── SAF ─────────────────────────────────────────────────────────────────────
let _safDirUri: string | null | undefined = undefined;

async function loadSafUri(): Promise<string | null> {
  if (_safDirUri !== undefined) return _safDirUri;
  const stored = await AsyncStorage.getItem(SAF_URI_KEY).catch(() => null);
  const fs = getFS();
  if (!fs) { _safDirUri = null; return null; }
  if (stored) {
    try {
      await fs.StorageAccessFramework.readDirectoryAsync(stored);
      _safDirUri = stored;
      return stored;
    } catch {
      _safDirUri = null;
      await AsyncStorage.removeItem(SAF_URI_KEY).catch(() => null);
    }
  } else {
    _safDirUri = null;
  }
  return null;
}

export async function requestDownloadsPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  const fs = getFS();
  if (!fs) return false;
  try {
    const result = await fs.StorageAccessFramework.requestDirectoryPermissionsAsync(
      'content://com.android.externalstorage.documents/tree/primary%3ADownload'
    );
    if (!result.granted) return false;
    _safDirUri = result.directoryUri;
    await AsyncStorage.setItem(SAF_URI_KEY, result.directoryUri).catch(() => null);
    return true;
  } catch { return false; }
}

export async function resetDownloadsPermission(): Promise<void> {
  _safDirUri = null;
  await AsyncStorage.removeItem(SAF_URI_KEY).catch(() => null);
}

export async function hasDownloadsPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  return (await loadSafUri()) !== null;
}

/**
 * 将下载完成的文件移动到 SAF 公共 Downloads 目录。
 * 小文件（≤50MB）使用 Base64 跨协议复制；大文件保留在缓存目录避免 OOM。
 */
async function moveToSafDownloads(tempUri: string, filename: string, expectedSize: number): Promise<{ uri: string; safFailed: boolean }> {
  const fs = getFS();
  if (!fs) return { uri: tempUri, safFailed: false };
  try {
    const dirUri = await loadSafUri();
    if (!dirUri) return { uri: tempUri, safFailed: false };

    // 大文件保护：超过 50MB 不通过 Base64 转换，直接保留在缓存目录
    if (expectedSize > SAF_BASE64_MAX_SIZE) {
      console.warn(`[DownloadManager] 文件 ${filename} (${(expectedSize / 1024 / 1024).toFixed(1)}MB) 超过 SAF Base64 限制，保留在缓存目录`);
      return { uri: tempUri, safFailed: true };
    }

    const destUri = await fs.StorageAccessFramework.createFileAsync(
      dirUri, filename, getMimeType(filename)
    );
    const base64 = await fs.readAsStringAsync(tempUri, { encoding: fs.EncodingType.Base64 });
    await fs.StorageAccessFramework.writeAsStringAsync(destUri, base64, {
      encoding: fs.EncodingType.Base64,
    });
    await fs.deleteAsync(tempUri, { idempotent: true }).catch(() => null);
    return { uri: destUri, safFailed: false };
  } catch (e) {
    console.warn('[DownloadManager] SAF 移动失败:', (e as Error)?.message);
    return { uri: tempUri, safFailed: true };
  }
}

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
  /** pauseAsync() 返回的恢复数据，resume 时传给 createDownloadResumable */
  resumeData?: string;
  /** 自动重试计数 */
  _autoRetryCount?: number;
}

/** 全局刷新事件类型：替代 __refresh__ 魔法字符串 */
export const REFRESH_EVENT = Symbol('download_refresh');

type ProgressCallback = (task: DownloadTask | { id: typeof REFRESH_EVENT }) => void;

// ─── 全局状态 ─────────────────────────────────────────────────────────────────
const tasks = new Map<string, DownloadTask>();
const subscribers = new Set<ProgressCallback>();
/** 活跃的 DownloadResumable 实例，用于 pause */
const activeResumables = new Map<string, ReturnType<typeof _FileSystem.createDownloadResumable>>();
/** 速度计算：上次回调时间和字节数 */
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

/** 判断是否为可自动重试的临时错误 */
function isTransientError(msg: string): boolean {
  return (
    msg.includes('Network request failed') ||
    msg.includes('Unable to resolve host') ||
    msg.includes('timeout') ||
    msg.includes('ETIMEDOUT') ||
    msg.includes('ECONNRESET') ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('ENOTFOUND') ||
    msg.includes('socket hang up')
  );
}

/** 清理临时下载目录 */
async function cleanupTempDir(id: string) {
  if (IS_WEB) return;
  const fs = getFS();
  if (!fs) return;
  const tempDir = `${fs.documentDirectory ?? ''}dl_${id}/`;
  await fs.deleteAsync(tempDir, { idempotent: true }).catch(() => null);
}

// ─── 核心下载逻辑 ─────────────────────────────────────────────────────────────
async function startTask(id: string) {
  const task = tasks.get(id);
  if (!task) return;

  // Web 端：直接在浏览器新标签打开
  if (IS_WEB) {
    task.status = 'completed';
    task.progress = 1;
    task.localUri = task.url;
    if (typeof window !== 'undefined') window.open(task.url, '_blank');
    notify(task);
    flushQueue();
    return;
  }

  const fs = getFS();
  if (!fs) { task.status = 'failed'; task.error = '文件系统不可用'; notify(task); flushQueue(); return; }

  const tempDir = `${fs.documentDirectory ?? ''}dl_${id}/`;
  const localUri = `${tempDir}${task.filename}`;

  await fs.makeDirectoryAsync(tempDir, { intermediates: true }).catch(() => null);

  task.status = 'downloading';
  task.error = null;
  speedSampler.set(id, { ts: Date.now(), bytes: 0 });
  notify(task);

  const progressCallback = (dp: { totalBytesWritten: number; totalBytesExpectedToWrite: number }) => {
    const t = tasks.get(id);
    if (!t || t.status !== 'downloading') return;

    const { totalBytesWritten, totalBytesExpectedToWrite } = dp;
    const now = Date.now();
    const prev = speedSampler.get(id) ?? { ts: now, bytes: 0 };
    const elapsed = (now - prev.ts) / 1000;

    // 速度计算（每 500ms 重置一次采样窗口，避免速度跳跃）
    let speed = t.speed;
    if (elapsed >= 0.5) {
      const bytesDelta = totalBytesWritten - prev.bytes;
      speed = elapsed > 0 ? Math.round(bytesDelta / elapsed) : 0;
      speedSampler.set(id, { ts: now, bytes: totalBytesWritten });
    }

    t.bytesWritten = totalBytesWritten;
    // 处理 totalBytesExpectedToWrite 为 -1（服务器未返回 Content-Length）的情况
    const hasTotal = totalBytesExpectedToWrite > 0;
    if (hasTotal) {
      t.totalBytes = totalBytesExpectedToWrite;
      t.progress = totalBytesWritten / totalBytesExpectedToWrite;
    } else {
      // 未知总大小：基于已下载字节数显示伪进度（下载量本身）
      t.progress = totalBytesWritten > 0 ? Math.min(0.99, 1 - 1 / (totalBytesWritten / 1024 + 1)) : 0;
    }
    t.speed = speed > 0 ? speed : 0;
    t.eta = (speed > 0 && hasTotal)
      ? Math.round((totalBytesExpectedToWrite - totalBytesWritten) / speed)
      : -1;

    notify(t);
  };

  // 使用 resumeData（暂停后恢复）或直接下载
  const resumable = fs.createDownloadResumable(
    task.url,
    localUri,
    {},
    progressCallback,
    task.resumeData,
  );
  activeResumables.set(id, resumable);

  try {
    const result = await resumable.downloadAsync();
    activeResumables.delete(id);
    speedSampler.delete(id);

    const t = tasks.get(id);
    if (!t) return;

    // 暂停/取消时 downloadAsync 返回 undefined
    if (!result) {
      if (t.status !== 'paused' && t.status !== 'cancelled') {
        t.status = 'failed';
        t.error = '下载中断，请重试';
        notify(t);
      }
      flushQueue();
      return;
    }

    // 校验文件（传入预期大小）
    const validErr = await validateFile(result.uri, t.totalBytes);
    if (validErr) {
      t.status = 'failed'; t.error = validErr; notify(t);
      await cleanupTempDir(id);
      flushQueue(); return;
    }

    // 完成：Android 写入公共 Downloads（SAF）
    t.status = 'completed';
    t.progress = 1;
    t.speed = 0;
    t.eta = 0;
    t.bytesWritten = t.totalBytes || t.bytesWritten;
    t.resumeData = undefined;

    if (Platform.OS === 'android') {
      const { uri, safFailed } = await moveToSafDownloads(result.uri, t.filename, t.totalBytes);
      t.localUri = uri;
      // SAF 失败时在 error 中记录提示（非致命，文件仍可用）
      if (safFailed) {
        t.error = '文件保存在应用缓存目录（未授权公共存储权限）';
      }
      await fs.deleteAsync(tempDir, { idempotent: true }).catch(() => null);
    } else {
      t.localUri = result.uri;
    }

    notify(t);
    flushQueue();
  } catch (e: any) {
    activeResumables.delete(id);
    speedSampler.delete(id);

    const t = tasks.get(id);
    if (!t || t.status === 'paused' || t.status === 'cancelled') { flushQueue(); return; }

    const msg: string = e?.message ?? '';

    // 自动重试：临时网络错误且未超过重试次数
    if (isTransientError(msg) && (t._autoRetryCount ?? 0) < MAX_AUTO_RETRY) {
      t._autoRetryCount = (t._autoRetryCount ?? 0) + 1;
      t.status = 'pending';
      t.error = `网络波动，自动重试中 (${t._autoRetryCount}/${MAX_AUTO_RETRY})...`;
      t.progress = 0;
      t.speed = 0;
      t.eta = -1;
      notify(t);
      await cleanupTempDir(id);
      flushQueue();
      return;
    }

    t.status = 'failed';
    if (msg.includes('Network request failed') || msg.includes('Unable to resolve host'))
      t.error = '网络连接失败，请检查网络后重试';
    else if (msg.includes('No space left') || msg.includes('ENOSPC'))
      t.error = '存储空间不足，请清理后重试';
    else if (msg.includes('403') || msg.includes('Forbidden'))
      t.error = '下载链接已失效（403），请重新获取';
    else if (msg.includes('404') || msg.includes('Not Found'))
      t.error = '文件不存在（404），该版本可能已删除';
    else if (msg.includes('timeout') || msg.includes('ETIMEDOUT'))
      t.error = '下载超时，请检查网络后重试';
    else if (msg.includes('ECONNRESET') || msg.includes('ECONNREFUSED'))
      t.error = '连接被重置，请检查网络后重试';
    else if (msg.includes('ENOTFOUND') || msg.includes('DNS'))
      t.error = 'DNS 解析失败，请检查网络连接';
    else
      t.error = msg || '下载失败，请重试';

    notify(t);
    await cleanupTempDir(id);
    flushQueue();
  }
}

/** 校验下载完成的文件：检查存在性、大小（与预期对比） */
async function validateFile(uri: string, expectedSize: number): Promise<string | null> {
  if (IS_WEB || uri.startsWith('content://')) return null;
  const fs = getFS();
  if (!fs) return null;
  try {
    const info = await fs.getInfoAsync(uri);
    if (!info.exists) return '文件不存在，下载可能未完成';
    const actualSize = (info as any).size ?? 0;
    if (actualSize === 0) return '文件大小为 0，下载可能不完整';
    // 如果服务器提供了预期大小，校验实际大小是否匹配（允许 5% 误差）
    if (expectedSize > 0 && actualSize < expectedSize * 0.95) {
      return `文件大小异常（预期 ${formatBytes(expectedSize)}，实际 ${formatBytes(actualSize)}），下载可能不完整`;
    }
    return null;
  } catch { return null; }
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
  // 检查是否已有相同 URL 的活跃任务
  const existing = findTaskByUrl(params.url);
  if (existing && ['pending', 'downloading', 'paused'].includes(existing.status)) {
    return existing.id;
  }

  const id = genId();
  const task: DownloadTask = {
    id, ...params,
    status: 'pending', progress: 0, bytesWritten: 0, totalBytes: 0,
    speed: 0, eta: -1, localUri: null, error: null, createdAt: Date.now(),
    _autoRetryCount: 0,
  };
  tasks.set(id, task);
  notify(task);
  flushQueue();
  return id;
}

export function retry(oldId: string): string {
  const old = tasks.get(oldId);
  if (!old) return '';

  // 保留 resumeData 以便断点续传
  const resumeData = old.resumeData;
  tasks.delete(oldId);
  speedSampler.delete(oldId);
  activeResumables.delete(oldId);

  const newId = genId();
  const task: DownloadTask = {
    id: newId,
    url: old.url, filename: old.filename, appId: old.appId, appName: old.appName,
    owner: old.owner, repo: old.repo, avatarUrl: old.avatarUrl, version: old.version,
    status: 'pending', progress: 0, bytesWritten: 0, totalBytes: 0,
    speed: 0, eta: -1, localUri: null, error: null, createdAt: Date.now(),
    resumeData, // 保留断点续传数据
    _autoRetryCount: 0,
  };
  tasks.set(newId, task);
  notify(task);
  flushQueue();
  return newId;
}

export async function pause(id: string): Promise<void> {
  const task = tasks.get(id);
  if (!task || task.status !== 'downloading') return;

  const resumable = activeResumables.get(id);
  if (resumable) {
    try {
      const snapshot = await resumable.pauseAsync();
      if (snapshot?.resumeData) {
        task.resumeData = snapshot.resumeData;
      }
    } catch { /* pauseAsync 失败时丢弃 resumeData，下次从头下载 */ }
    activeResumables.delete(id);
  }

  speedSampler.delete(id);
  task.status = 'paused';
  task.speed = 0;
  task.eta = -1;
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

  // 先取消活跃下载再改状态，避免竞态
  const resumable = activeResumables.get(id);
  if (resumable) {
    try { await resumable.cancelAsync?.(); } catch { /* ignore */ }
    activeResumables.delete(id);
  }

  task.status = 'cancelled';
  speedSampler.delete(id);

  await cleanupTempDir(id);

  tasks.delete(id);
  notify(task);
  flushQueue();
}

export async function deleteFile(id: string): Promise<void> {
  const task = tasks.get(id);
  if (!task) return;

  // 活跃任务先取消
  if (['downloading', 'pending'].includes(task.status)) {
    await cancel(id);
    notifyRefresh();
    return;
  }

  // 删除本地文件
  if (!IS_WEB && task.localUri) {
    const fs = getFS();
    if (fs) await fs.deleteAsync(task.localUri, { idempotent: true }).catch(() => null);
  }

  tasks.delete(id);
  speedSampler.delete(id);
  notifyRefresh();
}

export function clearFinished(): void {
  for (const [id, task] of tasks.entries()) {
    if (['completed', 'failed', 'cancelled'].includes(task.status)) {
      tasks.delete(id);
      speedSampler.delete(id);
    }
  }
  notifyRefresh();
}

export async function pauseAll(): Promise<void> {
  const pausePromises: Promise<void>[] = [];
  for (const [id, task] of tasks) {
    if (task.status === 'downloading') {
      const resumable = activeResumables.get(id);
      if (resumable) {
        pausePromises.push(
          resumable.pauseAsync().then((s) => {
            if (s?.resumeData) task.resumeData = s.resumeData;
          }).catch(() => null)
        );
        activeResumables.delete(id);
      }
      speedSampler.delete(id);
      task.status = 'paused';
      task.speed = 0;
      task.eta = -1;
      notify(task);
    } else if (task.status === 'pending') {
      task.status = 'paused';
      task.speed = 0;
      task.eta = -1;
      notify(task);
    }
  }
  // 等待所有 pauseAsync 完成后再返回
  await Promise.all(pausePromises);
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
    const resumable = activeResumables.get(id);
    if (resumable) resumable.cancelAsync?.().catch(() => null);
    // 清理临时目录（fire-and-forget）
    cleanupTempDir(id);
  }
  tasks.clear();
  activeResumables.clear();
  speedSampler.clear();
  notifyRefresh();
}
/**
 * 下载管理器 v14 — expo-file-system createDownloadResumable
 *
 * 采用 Expo 官方下载 API：
 *  1. 用 AbortController + fetch(redirect:'follow') 获取最终 CDN URL（仅读 headers，不下载 body）
 *  2. 将最终 URL 传给 createDownloadResumable，完全绕过 GitHub 302 多级跳转
 *  3. 支持真正的断点续传（pauseAsync / resumeData）
 *
 * 历史：v13 使用 react-native-blob-util，因 OkHttp 原生层与 GitHub CDN SSL/HTTP2
 * 不兼容，产生 "ReactNativeBlobUtil request error"，已回退至 expo-file-system。
 */
import { Platform } from 'react-native';
import { fetch } from 'expo/fetch';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as _FileSystem from 'expo-file-system/legacy';

const IS_WEB = Platform.OS === 'web';
const SAF_URI_KEY = '@openappstore/saf_downloads_uri';
const MAX_CONCURRENT = 3;
const SAF_BASE64_MAX_SIZE = 50 * 1024 * 1024;
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

async function moveToSafDownloads(tempUri: string, filename: string, expectedSize: number): Promise<{ uri: string; safFailed: boolean }> {
  const fs = getFS();
  if (!fs) return { uri: tempUri, safFailed: false };
  try {
    const dirUri = await loadSafUri();
    if (!dirUri) return { uri: tempUri, safFailed: false };

    let actualSize = expectedSize;
    if (actualSize <= 0) {
      try {
        const info = await fs.getInfoAsync(tempUri);
        actualSize = (info as any).size ?? 0;
      } catch { /* ignore */ }
    }

    if (actualSize > SAF_BASE64_MAX_SIZE) {
      console.warn(`[DownloadManager] ${filename} (${(actualSize / 1024 / 1024).toFixed(1)}MB) 超过 SAF 限制，保留在缓存`);
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
  _autoRetryCount?: number;
}

export const REFRESH_EVENT = Symbol('download_refresh');

type ProgressCallback = (task: DownloadTask | { id: typeof REFRESH_EVENT }) => void;

// ─── 全局状态 ─────────────────────────────────────────────────────────────────
const tasks = new Map<string, DownloadTask>();
const subscribers = new Set<ProgressCallback>();
/** 活跃的 expo-file-system DownloadResumable，用于暂停/取消 */
const activeSessions = new Map<string, _FileSystem.DownloadResumable>();
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

function mapErrorMessage(msg: string): string {
  if (!msg) return '下载失败，请重试';
  if (msg.includes('Network request failed') || msg.includes('Unable to resolve host'))
    return '网络连接失败，请检查网络后重试';
  if (msg.includes('No space left') || msg.includes('ENOSPC'))
    return '存储空间不足，请清理后重试';
  if (msg.includes('403') || msg.includes('Forbidden'))
    return '下载链接已失效（403），请重新获取';
  if (msg.includes('404') || msg.includes('Not Found'))
    return '文件不存在（404），该版本可能已删除';
  if (msg.includes('timeout') || msg.includes('ETIMEDOUT'))
    return '下载超时，请检查网络后重试';
  if (msg.includes('ECONNRESET') || msg.includes('ECONNREFUSED'))
    return '连接被重置，请检查网络后重试';
  if (msg.includes('ENOTFOUND') || msg.includes('DNS'))
    return 'DNS 解析失败，请检查网络连接';
  return msg;
}

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
  task.progress = 0;
  task.bytesWritten = 0;
  task.totalBytes = 0;
  task.speed = 0;
  task.eta = -1;
  notify(task);

  // ── 用 AbortController 预解析 GitHub 重定向，获取最终 CDN URL ─────────────
  // GitHub browser_download_url 经 1-2 次 302 跳转到 objects.githubusercontent.com
  // expo-file-system createDownloadResumable 不跟随 302，必须先拿到最终地址
  // 用 AbortController 在收到 response headers 后立即 abort，不下载 body 避免浪费流量
  let resolvedUrl = task.url;
  try {
    const ctrl = new AbortController();
    const res = await fetch(task.url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'OpenAppStore/1.0' },
    });
    // response.url 是跟随所有重定向后的最终地址
    if (res.url && res.url !== task.url) resolvedUrl = res.url;
    // 立即 abort 停止 body 下载
    ctrl.abort();
    res.body?.cancel?.().catch(() => {});
  } catch {
    // 预解析失败（含 AbortError）均降级使用原始 URL
  }

  // ── expo-file-system createDownloadResumable ──────────────────────────────
  const progressCallback = (dp: { totalBytesWritten: number; totalBytesExpectedToWrite: number }) => {
    const t = tasks.get(id);
    if (!t || t.status !== 'downloading') return;

    const { totalBytesWritten, totalBytesExpectedToWrite } = dp;
    const now = Date.now();
    const prev = speedSampler.get(id) ?? { ts: now, bytes: 0 };
    const elapsed = (now - prev.ts) / 1000;

    let speed = t.speed;
    if (elapsed >= 0.5) {
      speed = Math.round((totalBytesWritten - prev.bytes) / elapsed);
      speedSampler.set(id, { ts: now, bytes: totalBytesWritten });
    }

    t.bytesWritten = totalBytesWritten;
    if (totalBytesExpectedToWrite > 0) t.totalBytes = totalBytesExpectedToWrite;
    t.progress = t.totalBytes > 0 ? totalBytesWritten / t.totalBytes : -1;
    t.speed = speed > 0 ? speed : 0;
    t.eta = speed > 0 && t.totalBytes > 0
      ? Math.round((t.totalBytes - totalBytesWritten) / speed)
      : -1;

    notify(t);
  };

  const resumable = fs.createDownloadResumable(
    resolvedUrl,
    localUri,
    { headers: { 'User-Agent': 'OpenAppStore/1.0' } },
    progressCallback,
  );
  activeSessions.set(id, resumable);

  // ── 卡顿检测：60s 无字节增量则取消并自动重试 ─────────────────────────────
  let lastBytesForStall = 0;
  const stallTimer = setInterval(() => {
    const t = tasks.get(id);
    if (!t || t.status !== 'downloading') { clearInterval(stallTimer); return; }
    if (t.bytesWritten === lastBytesForStall) {
      clearInterval(stallTimer);
      activeSessions.get(id)?.cancelAsync?.().catch(() => {});
      activeSessions.delete(id);
      if ((t._autoRetryCount ?? 0) < MAX_AUTO_RETRY) {
        t._autoRetryCount = (t._autoRetryCount ?? 0) + 1;
        t.status = 'pending';
        t.error = `下载无响应，自动重试 (${t._autoRetryCount}/${MAX_AUTO_RETRY})...`;
        t.progress = 0; t.speed = 0; t.eta = -1;
      } else {
        t.status = 'failed';
        t.error = '下载超时，请检查网络后手动重试';
      }
      notify(t);
      cleanupTempDir(id).then(() => flushQueue());
    } else {
      lastBytesForStall = t.bytesWritten;
    }
  }, 60_000);

  try {
    const result = await resumable.downloadAsync();

    clearInterval(stallTimer);
    activeSessions.delete(id);
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

    // 校验文件大小
    let actualSize = 0;
    try {
      const info = await fs.getInfoAsync(result.uri);
      actualSize = (info as any).size ?? 0;
    } catch { /* ignore */ }

    if (actualSize === 0) {
      t.status = 'failed';
      t.error = '下载文件大小为 0，请重试';
      notify(t);
      await cleanupTempDir(id);
      flushQueue();
      return;
    }

    t.status = 'completed';
    t.progress = 1;
    t.speed = 0;
    t.eta = 0;
    t.bytesWritten = actualSize;
    t.totalBytes = actualSize;

    if (Platform.OS === 'android') {
      let safResult = { uri: result.uri, safFailed: true };
      try {
        safResult = await moveToSafDownloads(result.uri, t.filename, actualSize);
      } catch (safErr) {
        console.warn('[DownloadManager] SAF 移动异常（已忽略）:', (safErr as Error)?.message);
      }
      t.localUri = safResult.uri;
      if (safResult.safFailed) {
        t.error = '文件已保存到缓存目录（可正常安装）';
      }
      await fs.deleteAsync(tempDir, { idempotent: true }).catch(() => null);
    } else {
      t.localUri = result.uri;
    }

    notify(t);
    flushQueue();
  } catch (e: any) {
    clearInterval(stallTimer);
    activeSessions.delete(id);
    speedSampler.delete(id);

    const t = tasks.get(id);
    if (!t) { flushQueue(); return; }

    const msg: string = e?.message ?? '';

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
    t.error = mapErrorMessage(msg);
    notify(t);
    await cleanupTempDir(id);
    flushQueue();
  }
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
  if (existing && ['pending', 'downloading', 'paused'].includes(existing.status)) {
    return existing.id;
  }
  if (existing && ['completed', 'failed'].includes(existing.status)) {
    tasks.delete(existing.id);
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

  tasks.delete(oldId);

  const newId = genId();
  const task: DownloadTask = {
    id: newId,
    url: old.url, filename: old.filename, appId: old.appId, appName: old.appName,
    owner: old.owner, repo: old.repo, avatarUrl: old.avatarUrl, version: old.version,
    status: 'pending', progress: 0, bytesWritten: 0, totalBytes: 0,
    speed: 0, eta: -1, localUri: null, error: null, createdAt: Date.now(),
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

  // 取消活跃的 session
  const session = activeSessions.get(id);
  if (session) {
    session?.cancelAsync?.().catch(() => {});
    activeSessions.delete(id);
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
    session?.cancelAsync?.().catch(() => {});
    activeSessions.delete(id);
  }

  task.status = 'cancelled';
  speedSampler.delete(id);
  await cleanupTempDir(id);
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
  for (const [id, task] of tasks) {
    if (task.status === 'downloading' || task.status === 'pending') {
      const session = activeSessions.get(id);
      if (session) {
        session?.cancelAsync?.().catch(() => {});
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
      session?.cancelAsync?.().catch(() => {});
      activeSessions.delete(id);
    }
    cleanupTempDir(id);
  }
  tasks.clear();
  speedSampler.clear();
  notifyRefresh();
}
/**
 * 下载管理器 v12 — fetch 下载 + 纯 JS base64 编码
 *
 * 设计决策：
 * 1. 统一用 fetch 下载：原生 HTTP 栈自动跟随 302→CDN，获取真实文件
 * 2. 纯 JS base64 编码：不依赖 btoa(Hermes 不稳定)，逐字节编码，稳定可靠
 * 3. 下载中进度 0%，完成后直接 100%（fetch 无中间进度回调）
 * 4. SAF 保存：Android 完成后写入公共 Downloads
 * 5. 自动重试：临时网络错误自动重试 1 次
 */
import { Platform } from 'react-native';
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
      console.warn(`[DownloadManager] ${filename} (${(actualSize / 1024 / 1024).toFixed(1)}MB) 超过 SAF 限制，保留在缓存目录`);
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
export type DownloadStatus = 'pending' | 'downloading' | 'processing' | 'paused' | 'completed' | 'failed' | 'cancelled';

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

function genId(): string { return `dl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`; }
function notify(task: DownloadTask) { subscribers.forEach((cb) => cb({ ...task })); }
function notifyRefresh() { subscribers.forEach((cb) => cb({ id: REFRESH_EVENT })); }

function flushQueue() {
  const active = [...tasks.values()].filter((t) => t.status === 'downloading' || t.status === 'processing').length;
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

// ─── 纯 JS base64 编码 ────────────────────────────────────────────────────────

/**
 * 将 ArrayBuffer 编码为 base64 字符串。
 * 纯 JavaScript 实现，不依赖 btoa（Hermes 对二进制大字符串不稳定）。
 * 分块处理避免长时间阻塞 UI 线程。
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const len = bytes.length;
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const chunks: string[] = [];
  const CHUNK_SIZE = 0x8000; // 32KB 输入 → ~43KB 输出

  for (let offset = 0; offset < len; offset += CHUNK_SIZE) {
    const end = Math.min(offset + CHUNK_SIZE, len);
    let result = '';
    for (let i = offset; i < end; i += 3) {
      const a = bytes[i];
      const b = i + 1 < len ? bytes[i + 1] : 0;
      const c = i + 2 < len ? bytes[i + 2] : 0;
      result += chars[a >> 2];
      result += chars[((a & 3) << 4) | (b >> 4)];
      result += (i + 1 < len) ? chars[((b & 15) << 2) | (c >> 6)] : '=';
      result += (i + 2 < len) ? chars[c & 63] : '=';
    }
    chunks.push(result);
  }
  return chunks.join('');
}

// ─── 核心下载逻辑 ─────────────────────────────────────────────────────────────

async function startTask(id: string) {
  const task = tasks.get(id);
  if (!task) return;

  // Web 端：浏览器打开
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

  try {
    // fetch 下载：原生 HTTP 栈自动跟随 302→CDN，获取真实文件
    const response = await fetch(task.url, {
      method: 'GET',
      headers: { 'Cache-Control': 'no-cache' },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const byteLength = arrayBuffer.byteLength;

    // 空文件
    if (byteLength === 0) {
      throw new Error('下载内容为空');
    }

    // 检测 HTML 错误页面（GitHub 可能返回 200 但内容是 HTML）
    if (byteLength < 1024) {
      const header = new TextDecoder().decode(arrayBuffer.slice(0, Math.min(512, byteLength)));
      if (header.trimStart().startsWith('<!') || header.trimStart().startsWith('<html')) {
        throw new Error('服务器返回了网页而非文件，请重试');
      }
    }

    // 转为 base64 写入磁盘
    task.status = 'processing';
    task.progress = 0.99;
    notify(task);

    const base64 = arrayBufferToBase64(arrayBuffer);
    await fs.writeAsStringAsync(localUri, base64, {
      encoding: fs.EncodingType.Base64,
    });

    const t = tasks.get(id);
    if (!t) return;

    t.status = 'completed';
    t.progress = 1;
    t.speed = 0;
    t.eta = 0;
    t.bytesWritten = byteLength;
    t.totalBytes = byteLength;

    if (Platform.OS === 'android') {
      const { uri, safFailed } = await moveToSafDownloads(localUri, t.filename, byteLength);
      t.localUri = uri;
      if (safFailed) {
        t.error = '文件保存在应用缓存目录（未授权公共存储权限）';
      }
      await fs.deleteAsync(tempDir, { idempotent: true }).catch(() => null);
    } else {
      t.localUri = localUri;
    }

    notify(t);
    flushQueue();
  } catch (e: any) {
    const t = tasks.get(id);
    if (!t) { flushQueue(); return; }

    const msg: string = e?.message ?? '';

    // 自动重试
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
  if (existing && ['pending', 'downloading', 'processing', 'paused'].includes(existing.status)) {
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
  task.status = 'cancelled';
  await cleanupTempDir(id);
  notify(task);
  tasks.delete(id);
  flushQueue();
}

export async function deleteFile(id: string): Promise<void> {
  const task = tasks.get(id);
  if (!task) return;

  if (['downloading', 'processing', 'pending'].includes(task.status)) {
    await cancel(id);
    notifyRefresh();
    return;
  }

  if (!IS_WEB && task.localUri) {
    const fs = getFS();
    if (fs) await fs.deleteAsync(task.localUri, { idempotent: true }).catch(() => null);
  }

  tasks.delete(id);
  notifyRefresh();
}

export function clearFinished(): void {
  for (const [id, task] of tasks.entries()) {
    if (['completed', 'failed', 'cancelled'].includes(task.status)) {
      tasks.delete(id);
    }
  }
  notifyRefresh();
}

export async function pauseAll(): Promise<void> {
  for (const [, task] of tasks) {
    if (task.status === 'downloading' || task.status === 'pending') {
      task.status = 'paused';
      task.speed = 0;
      task.eta = -1;
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
    cleanupTempDir(id);
  }
  tasks.clear();
  notifyRefresh();
}
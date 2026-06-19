/**
 * 下载管理器 v5 — 稳定可靠版
 *
 * 设计决策：
 * 1. 直接下载：不做 HEAD URL 解析（GitHub 302 由 Android 原生 HTTP 客户端透明跟随）
 * 2. 单线程：移除分片并行（大文件 Base64 合并导致 OOM，且收益有限）
 * 3. 暂停续传：pauseAsync() 保存 resumeData，resume 时带 resumeData 重建 Resumable
 * 4. 进度回调：移除节流门，每次回调都 notify，由 Context 防抖 150ms 控制渲染频率
 * 5. SAF 保存：Android 完成后写入公共 Downloads（静态导入 expo-file-system/legacy）
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as _FileSystem from 'expo-file-system/legacy';

const IS_WEB = Platform.OS === 'web';
const APP_FOLDER_NAME = '开源应用商店';
const SAF_URI_KEY = '@openappstore/saf_downloads_uri';
const MAX_CONCURRENT = 3;

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
    // 直接使用用户选择的目录，不再创建子文件夹
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

async function moveToSafDownloads(tempUri: string, filename: string): Promise<string> {
  const fs = getFS();
  if (!fs) return tempUri;
  try {
    const dirUri = await loadSafUri();
    if (!dirUri) return tempUri;
    // 创建 SAF 目标文件
    const destUri = await fs.StorageAccessFramework.createFileAsync(
      dirUri, filename, getMimeType(filename)
    );
    // 使用 Base64 读写代替 copyAsync（copyAsync 不支持 file:// → content:// 跨协议复制）
    const base64 = await fs.readAsStringAsync(tempUri, { encoding: fs.EncodingType.Base64 });
    await fs.StorageAccessFramework.writeAsStringAsync(destUri, base64, {
      encoding: fs.EncodingType.Base64,
    });
    await fs.deleteAsync(tempUri, { idempotent: true }).catch(() => null);
    return destUri;
  } catch { return tempUri; }
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
  if (bytesPerSec <= 0) return '';
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
}

type ProgressCallback = (task: DownloadTask) => void;

// ─── 全局状态 ─────────────────────────────────────────────────────────────────
const tasks = new Map<string, DownloadTask>();
const subscribers = new Set<ProgressCallback>();
/** 活跃的 DownloadResumable 实例，用于 pause */
const activeResumables = new Map<string, ReturnType<typeof _FileSystem.createDownloadResumable>>();
/** 速度计算：上次回调时间和字节数 */
const speedSampler = new Map<string, { ts: number; bytes: number }>();

function genId(): string { return `dl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`; }
function notify(task: DownloadTask) { subscribers.forEach((cb) => cb({ ...task })); }

function flushQueue() {
  const active = [...tasks.values()].filter((t) => t.status === 'downloading').length;
  if (active >= MAX_CONCURRENT) return;
  const next = [...tasks.values()].find((t) => t.status === 'pending');
  if (next) startTask(next.id);
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
  if (!fs) { task.status = 'failed'; task.error = '文件系统不可用'; notify(task); return; }

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
      speed = Math.round((totalBytesWritten - prev.bytes) / elapsed);
      speedSampler.set(id, { ts: now, bytes: totalBytesWritten });
    }

    t.bytesWritten = totalBytesWritten;
    t.totalBytes = totalBytesExpectedToWrite > 0 ? totalBytesExpectedToWrite : t.totalBytes;
    t.progress = t.totalBytes > 0 ? totalBytesWritten / t.totalBytes : 0;
    t.speed = speed > 0 ? speed : 0;
    t.eta = (speed > 0 && t.totalBytes > 0)
      ? Math.round((t.totalBytes - totalBytesWritten) / speed)
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

    // 校验文件
    const validErr = await validateFile(result.uri);
    if (validErr) {
      t.status = 'failed'; t.error = validErr; notify(t);
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
      t.localUri = await moveToSafDownloads(result.uri, t.filename);
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

    t.status = 'failed';
    const msg: string = e?.message ?? '';
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
    else
      t.error = msg || '下载失败，请重试';

    notify(t);
    flushQueue();
  }
}

async function validateFile(uri: string): Promise<string | null> {
  if (IS_WEB || uri.startsWith('content://')) return null;
  const fs = getFS();
  if (!fs) return null;
  try {
    const info = await fs.getInfoAsync(uri);
    if (!info.exists) return '文件不存在，下载可能未完成';
    if ((info as any).size === 0) return '文件大小为 0，下载可能不完整';
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
  return [...tasks.values()].find((t) => t.url === url);
}

export function enqueue(params: {
  url: string; filename: string; appId: number; appName: string;
  owner: string; repo: string; avatarUrl: string; version: string;
}): string {
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
  speedSampler.delete(oldId);
  activeResumables.delete(oldId);
  return enqueue({
    url: old.url, filename: old.filename, appId: old.appId, appName: old.appName,
    owner: old.owner, repo: old.repo, avatarUrl: old.avatarUrl, version: old.version,
  });
}

export async function pause(id: string): Promise<void> {
  const task = tasks.get(id);
  if (!task || task.status !== 'downloading') return;

  const resumable = activeResumables.get(id);
  if (resumable) {
    try {
      const snapshot = await resumable.pauseAsync();
      task.resumeData = snapshot?.resumeData ?? undefined;
    } catch { /* ignore */ }
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
  notify(task);
  flushQueue();
}

export async function cancel(id: string): Promise<void> {
  const task = tasks.get(id);
  if (!task) return;
  task.status = 'cancelled';

  const resumable = activeResumables.get(id);
  if (resumable) {
    try { resumable.cancelAsync?.(); } catch { /* ignore */ }
    activeResumables.delete(id);
  }
  speedSampler.delete(id);

  // 清理临时目录
  if (!IS_WEB) {
    const fs = getFS();
    if (fs) {
      const tempDir = `${fs.documentDirectory ?? ''}dl_${id}/`;
      fs.deleteAsync(tempDir, { idempotent: true }).catch(() => null);
    }
  }

  tasks.delete(id);
  notify({ ...task });
  flushQueue();
}

export async function deleteFile(id: string): Promise<void> {
  const task = tasks.get(id);
  if (!task) return;

  if (['downloading', 'pending'].includes(task.status)) {
    await cancel(id);
    subscribers.forEach((cb) => cb({ id: '__refresh__' } as any));
    return;
  }

  if (!IS_WEB && task.localUri) {
    const fs = getFS();
    if (fs) fs.deleteAsync(task.localUri, { idempotent: true }).catch(() => null);
  }

  tasks.delete(id);
  speedSampler.delete(id);
  subscribers.forEach((cb) => cb({ id: '__refresh__' } as any));
}

export function clearFinished(): void {
  for (const [id, task] of tasks.entries()) {
    if (['completed', 'failed', 'cancelled'].includes(task.status)) {
      tasks.delete(id);
      speedSampler.delete(id);
    }
  }
  subscribers.forEach((cb) => cb({ id: '__refresh__' } as any));
}

export function pauseAll(): void {
  for (const [id, task] of tasks) {
    if (task.status === 'downloading' || task.status === 'pending') {
      if (task.status === 'downloading') {
        const resumable = activeResumables.get(id);
        if (resumable) {
          resumable.pauseAsync().then((s) => {
            task.resumeData = s?.resumeData ?? undefined;
          }).catch(() => null);
          activeResumables.delete(id);
        }
        speedSampler.delete(id);
      }
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
      notify(task);
    }
  }
  flushQueue();
}

export function clearAllTasks(): void {
  for (const [id] of tasks.entries()) {
    const resumable = activeResumables.get(id);
    if (resumable) resumable.cancelAsync?.().catch(() => null);
  }
  tasks.clear();
  activeResumables.clear();
  speedSampler.clear();
  subscribers.forEach((cb) => cb({ id: '__refresh__' } as any));
}

/**
 * 下载管理引擎
 * - 支持最多 3 个并发下载
 * - 每个任务可暂停 / 恢复 / 取消
 * - 实时回调：进度、速度（bytes/s）、完成、失败
 * - Android：下载完成后自动将文件移至 Downloads/开源应用搜索/ 公共目录（SAF）
 * - Web：通过浏览器 window.open 触发下载，不依赖 expo-file-system
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const IS_WEB = Platform.OS === 'web';

const APP_FOLDER_NAME = '开源应用搜索';
const SAF_URI_KEY = '@openappstore/saf_downloads_uri';

// 内存缓存 SAF 目录 URI；undefined = 尚未初始化，null = 无权限/非 Android
let _safDirUri: string | null | undefined = undefined;

// ─── 懒加载 expo-file-system（Web 端跳过，避免 OPFS 崩溃）──────────────
let _fsModule: any = null;
async function getFS() {
  if (IS_WEB) return null;
  if (!_fsModule) {
    _fsModule = await import('expo-file-system/legacy');
  }
  return _fsModule;
}

/** 从 AsyncStorage 恢复上次已授权的 SAF 目录 URI，并验证权限是否仍有效 */
async function loadSafUri(): Promise<string | null> {
  if (_safDirUri !== undefined) return _safDirUri;
  const stored = await AsyncStorage.getItem(SAF_URI_KEY).catch(() => null);
  const fs = await getFS();
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

/**
 * 弹出系统文件夹选择器，引导用户授权 Download 目录。
 * 授权成功后自动在其中创建「开源应用搜索」子目录并持久化 URI。
 * 返回 true 表示已成功获取目录权限。
 */
export async function requestDownloadsPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  const fs = await getFS();
  if (!fs) return false;
  try {
    const result = await fs.StorageAccessFramework.requestDirectoryPermissionsAsync(
      'content://com.android.externalstorage.documents/tree/primary%3ADownload'
    );
    if (!result.granted) return false;

    let finalUri = result.directoryUri;
    try {
      finalUri = await fs.StorageAccessFramework.makeDirectoryAsync(
        result.directoryUri,
        APP_FOLDER_NAME
      );
    } catch {
      // makeDirectoryAsync 可能不存在（老版本）或目录已存在，使用父目录
    }

    _safDirUri = finalUri;
    await AsyncStorage.setItem(SAF_URI_KEY, finalUri).catch(() => null);
    return true;
  } catch {
    return false;
  }
}

/** 清除已保存的 SAF 授权（用于设置页重置） */
export async function resetDownloadsPermission(): Promise<void> {
  _safDirUri = null;
  await AsyncStorage.removeItem(SAF_URI_KEY).catch(() => null);
}

/** 检查是否已有 Downloads SAF 权限 */
export async function hasDownloadsPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  const uri = await loadSafUri();
  return uri !== null;
}

/** 推断文件 MIME 类型 */
export function getMimeType(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.apk'))    return 'application/vnd.android.package-archive';
  if (lower.endsWith('.ipa'))    return 'application/octet-stream';
  if (lower.endsWith('.exe'))    return 'application/vnd.microsoft.portable-executable';
  if (lower.endsWith('.msi'))    return 'application/x-msi';
  if (lower.endsWith('.dmg'))    return 'application/x-apple-diskimage';
  if (lower.endsWith('.pkg'))    return 'application/octet-stream';
  if (lower.endsWith('.deb'))    return 'application/vnd.debian.binary-package';
  if (lower.endsWith('.rpm'))    return 'application/x-rpm';
  if (lower.endsWith('.appimage')) return 'application/octet-stream';
  if (lower.endsWith('.zip'))    return 'application/zip';
  if (lower.endsWith('.tar.gz') || lower.endsWith('.tgz')) return 'application/gzip';
  if (lower.endsWith('.tar'))    return 'application/x-tar';
  if (lower.endsWith('.7z'))     return 'application/x-7z-compressed';
  return 'application/octet-stream';
}

/** 判断文件是否为安装包（各平台安装程序格式） */
export function isInstallerFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  return (
    lower.endsWith('.apk') ||
    lower.endsWith('.ipa') ||
    lower.endsWith('.exe') ||
    lower.endsWith('.msi') ||
    lower.endsWith('.dmg') ||
    lower.endsWith('.pkg') ||
    lower.endsWith('.deb') ||
    lower.endsWith('.rpm') ||
    lower.endsWith('.appimage')
  );
}

/**
 * 验证已下载文件是否有效：文件存在且大小 > 0。
 * Web 端跳过验证，content:// SAF URI 无法用 getInfoAsync 校验，默认视为有效。
 */
async function validateFile(uri: string): Promise<string | null> {
  if (IS_WEB) return null;
  if (uri.startsWith('content://')) return null;
  const fs = await getFS();
  if (!fs) return null;
  try {
    const info = await fs.getInfoAsync(uri);
    if (!info.exists) return '文件不存在，可能已被删除';
    if ((info as any).size === 0) return '文件大小为 0，下载可能不完整';
    return null;
  } catch {
    return null;
  }
}

/**
 * 将已下载到 documentDirectory 的临时文件复制到 SAF Downloads 目录。
 */
async function moveToSafDownloads(tempUri: string, filename: string): Promise<string> {
  const fs = await getFS();
  if (!fs) return tempUri;
  try {
    const dirUri = await loadSafUri();
    if (!dirUri) return tempUri;

    const mimeType = getMimeType(filename);
    const destUri = await fs.StorageAccessFramework.createFileAsync(dirUri, filename, mimeType);
    await fs.StorageAccessFramework.copyAsync({ from: tempUri, to: destUri });
    await fs.deleteAsync(tempUri, { idempotent: true }).catch(() => null);
    return destUri;
  } catch {
    return tempUri;
  }
}

export type DownloadStatus =
  | 'pending'
  | 'downloading'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

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
  localUri: string | null;
  error: string | null;
  createdAt: number;
}

type ProgressCallback = (task: DownloadTask) => void;

const MAX_CONCURRENT = 3;

const tasks = new Map<string, DownloadTask>();
const resumables = new Map<string, any>();
const resumeSnapshots = new Map<string, string>();
const lastProgressTime = new Map<string, { ts: number; bytes: number }>();
const subscribers = new Set<ProgressCallback>();

function genId(): string {
  return `dl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function notify(task: DownloadTask) {
  subscribers.forEach((cb) => cb({ ...task }));
}

function flushQueue() {
  const downloading = [...tasks.values()].filter((t) => t.status === 'downloading').length;
  if (downloading >= MAX_CONCURRENT) return;
  const next = [...tasks.values()].find((t) => t.status === 'pending');
  if (next) startTask(next.id);
}

// 启动单个任务
async function startTask(id: string) {
  const task = tasks.get(id);
  if (!task) return;

  task.status = 'downloading';
  notify(task);

  // Web 端：直接用 window.open 触发浏览器下载，立即标记完成
  if (IS_WEB) {
    try {
      if (typeof window !== 'undefined') {
        window.open(task.url, '_blank');
      }
      task.status = 'completed';
      task.progress = 1;
      task.localUri = task.url;
    } catch (e: any) {
      task.status = 'failed';
      task.error = e?.message ?? '下载失败';
    }
    notify(task);
    flushQueue();
    return;
  }

  const fs = await getFS();
  if (!fs) {
    task.status = 'failed';
    task.error = '文件系统不可用';
    notify(task);
    return;
  }

  const dir = (fs.documentDirectory ?? '') +
    (Platform.OS === 'android' ? `dl_temp_${id}/` : `${APP_FOLDER_NAME}/`);
  await fs.makeDirectoryAsync(dir, { intermediates: true }).catch(() => null);
  const localUri = dir + task.filename;
  task.localUri = localUri;
  lastProgressTime.set(id, { ts: Date.now(), bytes: 0 });

  const resumable = fs.createDownloadResumable(
    task.url,
    localUri,
    {},
    (dp: any) => {
      const t = tasks.get(id);
      if (!t || t.status !== 'downloading') return;

      const { totalBytesWritten, totalBytesExpectedToWrite } = dp;
      const prev = lastProgressTime.get(id) ?? { ts: Date.now(), bytes: 0 };
      const now = Date.now();
      const elapsed = (now - prev.ts) / 1000;
      const delta = totalBytesWritten - prev.bytes;
      const speed = elapsed > 0 ? Math.round(delta / elapsed) : 0;

      lastProgressTime.set(id, { ts: now, bytes: totalBytesWritten });

      t.bytesWritten = totalBytesWritten;
      t.totalBytes = totalBytesExpectedToWrite;
      t.progress = totalBytesExpectedToWrite > 0
        ? totalBytesWritten / totalBytesExpectedToWrite
        : 0;
      t.speed = speed;

      notify(t);
    }
  );

  resumables.set(id, resumable);

  try {
    const result = await resumable.downloadAsync();
    const t = tasks.get(id);
    if (!t) return;

    if (result) {
      const validErr = await validateFile(result.uri);
      if (validErr) {
        t.status = 'failed';
        t.error = validErr;
        notify(t);
        return;
      }

      t.status = 'completed';
      t.progress = 1;
      t.speed = 0;
      if (Platform.OS === 'android') {
        t.localUri = await moveToSafDownloads(result.uri, task.filename);
        await fs.deleteAsync(dir, { idempotent: true }).catch(() => null);
      } else {
        t.localUri = result.uri;
      }
    } else {
      if (t.status !== 'cancelled') t.status = 'cancelled';
    }
    notify(t);
  } catch (e: any) {
    const t = tasks.get(id);
    if (!t) return;
    if (t.status !== 'cancelled' && t.status !== 'paused') {
      t.status = 'failed';
      const msg: string = e?.message ?? '';
      if (msg.includes('Network request failed') || msg.includes('Unable to resolve host')) {
        t.error = '网络连接失败，请检查网络后重试';
      } else if (msg.includes('No space left') || msg.includes('ENOSPC')) {
        t.error = '存储空间不足，请清理设备空间后重试';
      } else if (msg.includes('403') || msg.includes('Forbidden')) {
        t.error = '下载链接无权访问（403），请重新获取';
      } else if (msg.includes('404') || msg.includes('Not Found')) {
        t.error = '文件不存在（404），该版本可能已删除';
      } else if (msg.includes('timeout') || msg.includes('ETIMEDOUT')) {
        t.error = '下载超时，请检查网络连接后重试';
      } else {
        t.error = msg || '下载失败，请重试';
      }
      notify(t);
    }
  } finally {
    resumables.delete(id);
    lastProgressTime.delete(id);
    flushQueue();
  }
}

// ─── 公开 API ──────────────────────────────────────────────

export function subscribe(cb: ProgressCallback): () => void {
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}

export function getAllTasks(): DownloadTask[] {
  return [...tasks.values()].sort((a, b) => b.createdAt - a.createdAt);
}

export function getTask(id: string): DownloadTask | undefined {
  return tasks.get(id);
}

export function findTaskByUrl(url: string): DownloadTask | undefined {
  return [...tasks.values()].find((t) => t.url === url);
}

export function enqueue(params: {
  url: string;
  filename: string;
  appId: number;
  appName: string;
  owner: string;
  repo: string;
  avatarUrl: string;
  version: string;
}): string {
  const id = genId();
  const task: DownloadTask = {
    id,
    url: params.url,
    filename: params.filename,
    appId: params.appId,
    appName: params.appName,
    owner: params.owner,
    repo: params.repo,
    avatarUrl: params.avatarUrl,
    version: params.version,
    status: 'pending',
    progress: 0,
    bytesWritten: 0,
    totalBytes: 0,
    speed: 0,
    localUri: null,
    error: null,
    createdAt: Date.now(),
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
  lastProgressTime.delete(oldId);
  resumeSnapshots.delete(oldId);
  return enqueue({
    url: old.url,
    filename: old.filename,
    appId: old.appId,
    appName: old.appName,
    owner: old.owner,
    repo: old.repo,
    avatarUrl: old.avatarUrl,
    version: old.version,
  });
}

export async function pause(id: string): Promise<void> {
  const task = tasks.get(id);
  if (!task || task.status !== 'downloading') return;

  const resumable = resumables.get(id);
  if (resumable) {
    try {
      const snapshot = await resumable.pauseAsync();
      if (snapshot?.resumeData) resumeSnapshots.set(id, snapshot.resumeData);
    } catch { /* ignore */ }
    resumables.delete(id);
  }
  task.status = 'paused';
  task.speed = 0;
  notify(task);
}

export async function resume(id: string): Promise<void> {
  const task = tasks.get(id);
  if (!task || task.status !== 'paused') return;

  const downloading = [...tasks.values()].filter((t) => t.status === 'downloading').length;
  if (downloading >= MAX_CONCURRENT) {
    task.status = 'pending';
    notify(task);
    return;
  }

  task.status = 'downloading';
  notify(task);

  const fs = await getFS();
  if (!fs) {
    task.status = 'failed';
    task.error = '文件系统不可用';
    notify(task);
    return;
  }

  const localUri = task.localUri ?? fs.documentDirectory + task.filename;
  task.localUri = localUri;
  lastProgressTime.set(id, { ts: Date.now(), bytes: task.bytesWritten });

  const progressCallback = (dp: any) => {
    const t = tasks.get(id);
    if (!t || t.status !== 'downloading') return;
    const { totalBytesWritten, totalBytesExpectedToWrite } = dp;
    const prev = lastProgressTime.get(id) ?? { ts: Date.now(), bytes: 0 };
    const now = Date.now();
    const elapsed = (now - prev.ts) / 1000;
    const delta = totalBytesWritten - prev.bytes;
    lastProgressTime.set(id, { ts: now, bytes: totalBytesWritten });
    t.bytesWritten = totalBytesWritten;
    t.totalBytes = totalBytesExpectedToWrite;
    t.progress = totalBytesExpectedToWrite > 0 ? totalBytesWritten / totalBytesExpectedToWrite : 0;
    t.speed = elapsed > 0 ? Math.round(delta / elapsed) : 0;
    notify(t);
  };

  const savedResumeData = resumeSnapshots.get(id);
  resumeSnapshots.delete(id);

  const resumable = savedResumeData
    ? new fs.DownloadResumable(task.url, localUri, {}, progressCallback, savedResumeData)
    : fs.createDownloadResumable(task.url, localUri, {}, progressCallback);

  resumables.set(id, resumable);

  try {
    const result = await resumable.downloadAsync();
    const t = tasks.get(id);
    if (!t) return;
    if (result) {
      t.status = 'completed';
      t.progress = 1;
      t.localUri = result.uri;
      t.speed = 0;
    } else if (t.status !== 'cancelled') {
      t.status = 'cancelled';
    }
    notify(t);
  } catch (e: any) {
    const t = tasks.get(id);
    if (!t) return;
    if (t.status !== 'cancelled' && t.status !== 'paused') {
      t.status = 'failed';
      t.error = e?.message ?? '下载失败';
      notify(t);
    }
  } finally {
    resumables.delete(id);
    lastProgressTime.delete(id);
    flushQueue();
  }
}

export async function cancel(id: string): Promise<void> {
  const task = tasks.get(id);
  if (!task) return;

  const resumable = resumables.get(id);
  if (resumable) {
    try { await resumable.cancelAsync(); } catch { /* ignore */ }
    resumables.delete(id);
  }

  if (!IS_WEB && task.localUri && task.status !== 'completed') {
    const fs = await getFS();
    if (fs) {
      try { await fs.deleteAsync(task.localUri, { idempotent: true }); } catch { /* ignore */ }
    }
  }

  tasks.delete(id);
  lastProgressTime.delete(id);
  resumeSnapshots.delete(id);
  flushQueue();
}

export async function deleteFile(id: string): Promise<void> {
  const task = tasks.get(id);
  if (!task) return;

  if (!IS_WEB && task.localUri) {
    const fs = await getFS();
    if (fs) {
      try { await fs.deleteAsync(task.localUri, { idempotent: true }); } catch { /* ignore */ }
    }
  }

  tasks.delete(id);
  lastProgressTime.delete(id);
  subscribers.forEach((cb) => cb({ id: '__refresh__' } as any));
}

export function clearFinished(): void {
  for (const [id, task] of tasks.entries()) {
    if (['completed', 'failed', 'cancelled'].includes(task.status)) {
      tasks.delete(id);
    }
  }
  subscribers.forEach((cb) => cb({ id: '__refresh__' } as any));
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
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}


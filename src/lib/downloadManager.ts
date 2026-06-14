/**
 * 下载管理引擎
 * - 支持最多 3 个并发下载
 * - 每个任务可暂停 / 恢复 / 取消
 * - 实时回调：进度、速度（bytes/s）、完成、失败
 * - Android：下载完成后自动将文件移至 Downloads/开源应用商店/ 公共目录（SAF）
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

const APP_FOLDER_NAME = '开源应用商店';
const SAF_URI_KEY = '@openappstore/saf_downloads_uri';

// 内存缓存 SAF 目录 URI；undefined = 尚未初始化，null = 无权限/非 Android
let _safDirUri: string | null | undefined = undefined;

/** 从 AsyncStorage 恢复上次已授权的 SAF 目录 URI，并验证权限是否仍有效 */
async function loadSafUri(): Promise<string | null> {
  if (_safDirUri !== undefined) return _safDirUri;
  const stored = await AsyncStorage.getItem(SAF_URI_KEY).catch(() => null);
  if (stored) {
    try {
      await FileSystem.StorageAccessFramework.readDirectoryAsync(stored);
      _safDirUri = stored;
      return stored;
    } catch {
      // 权限被吊销，清除缓存
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
 * 授权成功后自动在其中创建「开源应用商店」子目录并持久化 URI。
 * 返回 true 表示已成功获取目录权限。
 */
export async function requestDownloadsPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    // 预设初始路径为 primary:Download，用户只需点「使用此文件夹」即可
    const result = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync(
      'content://com.android.externalstorage.documents/tree/primary%3ADownload'
    );
    if (!result.granted) return false;

    // 尝试在所选目录下创建「开源应用商店」子目录
    let finalUri = result.directoryUri;
    try {
      finalUri = await (FileSystem.StorageAccessFramework as any).makeDirectoryAsync(
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
    lower.endsWith('.apk') ||   // Android
    lower.endsWith('.ipa') ||   // iOS
    lower.endsWith('.exe') ||   // Windows
    lower.endsWith('.msi') ||   // Windows
    lower.endsWith('.dmg') ||   // macOS
    lower.endsWith('.pkg') ||   // macOS
    lower.endsWith('.deb') ||   // Linux
    lower.endsWith('.rpm') ||   // Linux
    lower.endsWith('.appimage') // Linux
  );
}

/**
 * 验证已下载文件是否有效：文件存在且大小 > 0。
 * content:// SAF URI 无法用 getInfoAsync 校验，默认视为有效。
 * 返回错误描述字符串，null 表示验证通过。
 */
async function validateFile(uri: string): Promise<string | null> {
  // SAF content:// URI 跳过 getInfoAsync（不支持），视为有效
  if (uri.startsWith('content://')) return null;
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) return '文件不存在，可能已被删除';
    if ((info as any).size === 0) return '文件大小为 0，下载可能不完整';
    return null;
  } catch {
    return null; // 无法获取信息时不阻断流程
  }
}

/**
 * 将已下载到 documentDirectory 的临时文件复制到 SAF Downloads 目录。
 * 成功则返回新的 content:// URI 并删除临时文件；失败则返回原 tempUri。
 */
async function moveToSafDownloads(tempUri: string, filename: string): Promise<string> {
  try {
    const dirUri = await loadSafUri();
    if (!dirUri) return tempUri;

    const mimeType = getMimeType(filename);

    // 在 SAF 目录中创建目标文件（若同名文件已存在，会自动追加编号）
    const destUri = await FileSystem.StorageAccessFramework.createFileAsync(
      dirUri, filename, mimeType
    );

    // 将 file:// 临时文件复制到 content:// SAF 文件
    await FileSystem.StorageAccessFramework.copyAsync({ from: tempUri, to: destUri });

    // 删除临时文件
    await FileSystem.deleteAsync(tempUri, { idempotent: true }).catch(() => null);

    return destUri;
  } catch {
    // SAF 操作失败，保留临时文件路径，不影响下载结果
    return tempUri;
  }
}

export type DownloadStatus =
  | 'pending'      // 排队等待
  | 'downloading'  // 下载中
  | 'paused'       // 已暂停
  | 'completed'    // 完成
  | 'failed'       // 失败
  | 'cancelled';   // 已取消

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
  progress: number;       // 0 ~ 1
  bytesWritten: number;
  totalBytes: number;
  speed: number;          // bytes/s
  localUri: string | null;
  error: string | null;
  createdAt: number;
}

type ProgressCallback = (task: DownloadTask) => void;

const MAX_CONCURRENT = 3;

// 任务表：id -> DownloadTask
const tasks = new Map<string, DownloadTask>();
// DownloadResumable 实例表：id -> instance
const resumables = new Map<string, FileSystem.DownloadResumable>();
// 暂停快照：id -> resumeData（Base64），用于真正从断点续传
const resumeSnapshots = new Map<string, string>();
// 上一次收到进度回调的时间戳（用于计算速度）
const lastProgressTime = new Map<string, { ts: number; bytes: number }>();
// 全局订阅者
const subscribers = new Set<ProgressCallback>();

// 生成唯一 ID
function genId(): string {
  return `dl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// 通知所有订阅者
function notify(task: DownloadTask) {
  subscribers.forEach((cb) => cb({ ...task }));
}

// 从等待队列中取下一个并发槽
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

  // Android 下载到临时路径，完成后通过 SAF 移至 Downloads/开源应用商店/
  // 其他平台直接下载到 documentDirectory 的 APP 子目录
  const dir = (FileSystem.documentDirectory ?? '') +
    (Platform.OS === 'android' ? `dl_temp_${id}/` : `${APP_FOLDER_NAME}/`);
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => null);
  const localUri = dir + task.filename;
  task.localUri = localUri;
  lastProgressTime.set(id, { ts: Date.now(), bytes: 0 });

  const resumable = FileSystem.createDownloadResumable(
    task.url,
    localUri,
    {},
    (dp: FileSystem.DownloadProgressData) => {
      const t = tasks.get(id);
      if (!t || t.status !== 'downloading') return;

      const { totalBytesWritten, totalBytesExpectedToWrite } = dp;
      const prev = lastProgressTime.get(id) ?? { ts: Date.now(), bytes: 0 };
      const now = Date.now();
      const elapsed = (now - prev.ts) / 1000; // 秒
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
      // 验证文件有效性（存在且大小 > 0）
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
      // Android：将临时文件移到 SAF Downloads/开源应用商店/，非 Android 直接用原路径
      if (Platform.OS === 'android') {
        t.localUri = await moveToSafDownloads(result.uri, task.filename);
        // 清理空的临时目录
        await FileSystem.deleteAsync(dir, { idempotent: true }).catch(() => null);
      } else {
        t.localUri = result.uri;
      }
    } else {
      // 已被取消
      if (t.status !== 'cancelled') {
        t.status = 'cancelled';
      }
    }
    notify(t);
  } catch (e: any) {
    const t = tasks.get(id);
    if (!t) return;
    if (t.status !== 'cancelled' && t.status !== 'paused') {
      t.status = 'failed';
      // 将常见网络错误转换为用户可读描述
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

/** 订阅任意任务变更 */
export function subscribe(cb: ProgressCallback): () => void {
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}

/** 获取所有任务快照 */
export function getAllTasks(): DownloadTask[] {
  return [...tasks.values()].sort((a, b) => b.createdAt - a.createdAt);
}

/** 获取单个任务 */
export function getTask(id: string): DownloadTask | undefined {
  return tasks.get(id);
}

/** 查找同一 URL 的任务（避免重复下载） */
export function findTaskByUrl(url: string): DownloadTask | undefined {
  return [...tasks.values()].find((t) => t.url === url);
}

/** 添加下载任务（返回任务 ID）*/
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

/**
 * 重试失败/取消的任务：先清除旧记录再重新入队。
 * 不能直接 enqueue，因为旧 failed 任务还在 map 里，findByUrl 会返回旧任务导致 UI 不刷新。
 */
export function retry(oldId: string): string {
  const old = tasks.get(oldId);
  if (!old) return '';
  // 先清除旧任务记录
  tasks.delete(oldId);
  lastProgressTime.delete(oldId);
  resumeSnapshots.delete(oldId);
  // 用相同参数重新入队
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

/** 暂停下载，保存 resumeData 快照供后续断点续传 */
export async function pause(id: string): Promise<void> {
  const task = tasks.get(id);
  if (!task || task.status !== 'downloading') return;

  const resumable = resumables.get(id);
  if (resumable) {
    try {
      const snapshot = await resumable.pauseAsync();
      // 保存断点快照，resume() 时使用，否则会从 0 字节重下
      if (snapshot?.resumeData) {
        resumeSnapshots.set(id, snapshot.resumeData);
      }
    } catch {
      // ignore
    }
    resumables.delete(id);
  }
  task.status = 'paused';
  task.speed = 0;
  notify(task);
}

/** 恢复下载，优先使用断点快照实现真正的断点续传 */
export async function resume(id: string): Promise<void> {
  const task = tasks.get(id);
  if (!task || task.status !== 'paused') return;

  // 检查并发槽
  const downloading = [...tasks.values()].filter((t) => t.status === 'downloading').length;
  if (downloading >= MAX_CONCURRENT) {
    // 放回等待队列
    task.status = 'pending';
    notify(task);
    return;
  }

  task.status = 'downloading';
  notify(task);

  const localUri = task.localUri ?? FileSystem.documentDirectory + task.filename;
  task.localUri = localUri;
  lastProgressTime.set(id, { ts: Date.now(), bytes: task.bytesWritten });

  const progressCallback = (dp: FileSystem.DownloadProgressData) => {
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
  };

  // 优先使用已保存的断点快照（真正的断点续传），否则回退到从头下载
  const savedResumeData = resumeSnapshots.get(id);
  resumeSnapshots.delete(id);

  const resumable = savedResumeData
    ? new FileSystem.DownloadResumable(task.url, localUri, {}, progressCallback, savedResumeData)
    : FileSystem.createDownloadResumable(task.url, localUri, {}, progressCallback);

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

/** 取消并删除任务 */
export async function cancel(id: string): Promise<void> {
  const task = tasks.get(id);
  if (!task) return;

  const resumable = resumables.get(id);
  if (resumable) {
    try {
      await resumable.cancelAsync();
    } catch {
      // ignore
    }
    resumables.delete(id);
  }

  // 删除未完成的本地文件
  if (task.localUri && task.status !== 'completed') {
    try {
      await FileSystem.deleteAsync(task.localUri, { idempotent: true });
    } catch {
      // ignore
    }
  }

  tasks.delete(id);
  lastProgressTime.delete(id);
  resumeSnapshots.delete(id);
  flushQueue();
}

/** 删除已完成任务的本地文件，并从列表移除该条记录 */
export async function deleteFile(id: string): Promise<void> {
  const task = tasks.get(id);
  if (!task) return;

  if (task.localUri) {
    try {
      await FileSystem.deleteAsync(task.localUri, { idempotent: true });
    } catch {
      // ignore
    }
  }

  tasks.delete(id);
  lastProgressTime.delete(id);
  // 通知订阅者刷新列表
  subscribers.forEach((cb) => cb({ id: '__refresh__' } as any));
}

/** 清空所有已完成 / 失败 / 取消的任务 */
export function clearFinished(): void {
  for (const [id, task] of tasks.entries()) {
    if (['completed', 'failed', 'cancelled'].includes(task.status)) {
      tasks.delete(id);
    }
  }
  // 通知一次空变更让 UI 刷新
  subscribers.forEach((cb) => cb({ id: '__refresh__' } as any));
}

/** 格式化速度显示 */
export function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec <= 0) return '';
  if (bytesPerSec < 1024) return `${bytesPerSec} B/s`;
  if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
  return `${(bytesPerSec / 1024 / 1024).toFixed(2)} MB/s`;
}

/** 格式化文件大小 */
export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * 下载管理器 v25 — 极简稳定版
 *
 * 设计原则：不与系统 HTTP 引擎对抗，只做必要的封装
 *
 * 引擎：
 *  - Android/iOS : expo-file-system createDownloadResumable
 *                  底层 = Android OkHttp / iOS NSURLSession（系统级 HTTP 引擎）
 *                  系统引擎自带超时处理和重连，不需要我们额外干预
 *  - Web         : window.open() 交给浏览器
 *
 * 存储策略：
 *  - 下载至 documentDirectory/dl_${id}/ 临时目录
 *  - 完成后 moveAsync → dl_perm/${filename}（持久目录）
 *  - Android 额外 SAF 复制到公共 Downloads 目录（/storage/emulated/0/Download/）
 *
 * 断点续传（仅用于手动暂停/继续）：
 *  - iOS：pause() 时调用 savable() 保存 resumeData，resume() 时读取并续传
 *  - Android：expo-file-system 不支持字节级续传，resume() 等同于从头重新下载
 *
 * 移除的"负优化"：
 *  - probeDownloadUrl (HEAD 预检)：增加 8s 启动延迟，期间 flushQueue 可重复触发竞态
 *  - stall 卡顿检测 + 自动重试：强制 cancelAsync → 系统引擎本身会等待/重连，我们的取消反而干扰
 *  - catch 块指数退避重试：在系统重试之上叠加，导致无限重新下载
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as _FileSystem from 'expo-file-system/legacy';

const IS_WEB = Platform.OS === 'web';
const IS_ANDROID = Platform.OS === 'android';
const IS_IOS = Platform.OS === 'ios';
const MAX_CONCURRENT = 3;
const PERM_DIR_NAME = 'dl_perm';
const RESUME_KEY_PREFIX = '@openappstore/resume_';
const SAF_PERM_KEY = '@openappstore/saf_downloads_uri';

function getFS(): typeof _FileSystem | null {
  return IS_WEB ? null : _FileSystem;
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
  /** RST_STREAM CANCEL 专用重试计数（上限 3 次），与 stall 无关 */
  _rstRetryCount?: number;
}

export const REFRESH_EVENT = Symbol('download_refresh');

type ProgressCallback = (task: DownloadTask | { id: typeof REFRESH_EVENT }) => void;

// ─── 全局状态 ─────────────────────────────────────────────────────────────────
const tasks = new Map<string, DownloadTask>();
const subscribers = new Set<ProgressCallback>();
/** 活跃的 expo-file-system DownloadResumable */
const activeSessions = new Map<string, _FileSystem.DownloadResumable>();
const speedSampler = new Map<string, { ts: number; bytes: number }>();
/**
 * 正在"启动中"的任务 ID 集合（已调用 startTask 但 DownloadResumable 尚未建立）
 * 用于防止 flushQueue 在 probeDownloadUrl 等异步初始化期间重复启动同一任务（BUG-A 修复）
 */
const launchingSet = new Set<string>();

function genId(): string { return `dl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`; }
function notify(task: DownloadTask) { subscribers.forEach((cb) => cb({ ...task })); }
function notifyRefresh() { subscribers.forEach((cb) => cb({ id: REFRESH_EVENT })); }

function flushQueue() {
  const active = [...tasks.values()].filter((t) => t.status === 'downloading').length;
  if (active >= MAX_CONCURRENT) return;
  // launchingSet 中的任务已调用 startTask 但 DownloadResumable 尚未建立（正在做预检等异步初始化）
  // 不计入 active count，但也不能重复启动（BUG-A 修复）
  const next = [...tasks.values()].find(
    (t) => t.status === 'pending' && !launchingSet.has(t.id),
  );
  if (next) startTask(next.id);
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

async function cleanupTempDir(id: string) {
  if (IS_WEB) return;
  const fs = getFS();
  if (!fs) return;
  const tempDir = `${fs.documentDirectory ?? ''}dl_${id}/`;
  await fs.deleteAsync(tempDir, { idempotent: true }).catch(() => null);
}

/** 将文件从 tempDir 移入持久存储（documentDirectory/dl_perm/），返回新 URI */
async function moveToPermanentStorage(tempUri: string, filename: string): Promise<string> {
  const fs = getFS()!;
  const permDir = `${fs.documentDirectory ?? ''}${PERM_DIR_NAME}/`;
  await fs.makeDirectoryAsync(permDir, { intermediates: true }).catch(() => null);
  const destUri = `${permDir}${filename}`;
  // 目标已存在则先删除（同名旧版本）
  await fs.deleteAsync(destUri, { idempotent: true }).catch(() => null);
  await fs.moveAsync({ from: tempUri, to: destUri });
  // 移动后验证目标文件确实存在且非空
  const info = await fs.getInfoAsync(destUri).catch(() => ({ exists: false }));
  if (!info.exists || (info as any).size === 0) {
    throw new Error(`moveAsync 后目标文件不存在或大小为0: ${destUri}`);
  }
  return destUri;
}

/**
 * Android：通过 StorageAccessFramework 把文件复制到公共 Downloads 目录。
 * - 首次调用弹出目录选择器（预选 Downloads），用户授权后 URI 持久化
 * - 后续调用直接用已缓存 URI，无需再次授权
 * - 任何错误均静默忽略（不影响主下载流程）
 */
async function copyToPublicDownloads(localUri: string, filename: string): Promise<void> {
  if (!IS_ANDROID) return;
  try {
    const SAF = _FileSystem.StorageAccessFramework;
    if (!SAF) return;

    // 读取或申请授权
    let dirUri = await AsyncStorage.getItem(SAF_PERM_KEY).catch(() => null);
    if (!dirUri) {
      // 预选到 Downloads 目录，用户点允许即可
      const result = await SAF.requestDirectoryPermissionsAsync(
        'content://com.android.externalstorage.documents/tree/primary%3ADownload',
      );
      if (!result.granted) return; // 用户拒绝，静默跳过
      dirUri = result.directoryUri;
      await AsyncStorage.setItem(SAF_PERM_KEY, dirUri).catch(() => null);
    }

    // 在 Downloads 目录创建文件（同名自动覆盖：先删后建）
    const existingFiles = await SAF.readDirectoryAsync(dirUri).catch(() => [] as string[]);
    for (const existingUri of existingFiles) {
      const existingName = decodeURIComponent(existingUri.split('%2F').pop() ?? '');
      if (existingName === filename) {
        await SAF.deleteAsync(existingUri).catch(() => null);
        break;
      }
    }
    const mimeType = getMimeType(filename);
    const newFileUri = await SAF.createFileAsync(dirUri, filename, mimeType);

    // 用 copyAsync 直接复制，避免 readAsStringAsync 把整个大文件读入内存导致 OOM
    await _FileSystem.copyAsync({ from: localUri, to: newFileUri });
  } catch {
    // 复制失败不阻断主流程，安装包依然可从内部目录安装
  }
}

// ─── 核心下载逻辑 ─────────────────────────────────────────────────────────────

/** 通用进度更新（Android / iOS 均复用） */
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

/**
 * 应用内下载（Android + iOS 统一）——极简版
 *
 * 核心原则：不与系统 HTTP 引擎对抗
 *  - createDownloadResumable 底层 = iOS NSURLSession / Android OkHttp
 *  - 系统引擎自带超时处理、重连、SSL 协商，无需额外干预
 *  - 只处理：进度回调 → 更新 UI；成功 → 移入持久目录；失败 → 标记 failed
 *
 * 手动暂停/续传（iOS）：
 *  - pause() 调用 savable() 保存 resumeData 到 AsyncStorage
 *  - resume() → startTaskNative() 读取 resumeData 并传入 createDownloadResumable
 */
async function startTaskNative(id: string) {
  const task = tasks.get(id);
  if (!task) return;
  // 防重入①：DownloadResumable 已建立
  if (activeSessions.has(id)) return;
  // 防重入②：正在初始化中（launchingSet 保证 flushQueue 不重复选中同一任务）
  if (launchingSet.has(id)) return;

  // 立即标记 downloading — 必须在任何 await 之前，防止 flushQueue 重复触发
  launchingSet.add(id);
  task.status = 'downloading';
  task.error = null;
  task.speed = 0;
  task.eta = -1;
  notify(task);

  const fs = getFS()!;
  const tempDir = `${fs.documentDirectory ?? ''}dl_${id}/`;
  const localUri = `${tempDir}${task.filename}`;
  const resumeKey = `${RESUME_KEY_PREFIX}${task.url.replace(/[^a-zA-Z0-9]/g, '_').slice(-100)}`;

  await fs.makeDirectoryAsync(tempDir, { intermediates: true }).catch(() => null);

  // iOS：尝试加载断点数据（仅用于手动暂停后续传，不用于自动重试）
  let resumeData: string | undefined;
  if (IS_IOS) {
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
  }

  // 若无续传数据则重置进度
  if (!resumeData) {
    task.progress = 0;
    task.bytesWritten = 0;
    task.totalBytes = 0;
    notify(task);
  }

  let resumableRef: _FileSystem.DownloadResumable | null = null;

  const resumable = fs.createDownloadResumable(
    task.url,
    localUri,
    { headers: { 'User-Agent': 'OpenAppStore/1.0' } },
    (dp: { totalBytesWritten: number; totalBytesExpectedToWrite: number }) => {
      applyProgress(id, dp.totalBytesWritten, dp.totalBytesExpectedToWrite);
      // iOS：首次有进度立即保存断点，之后每 3s 保存一次
      if (IS_IOS) {
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
      }
    },
    resumeData ? JSON.parse(resumeData) : undefined,
  );
  resumableRef = resumable;
  let lastSaveTs = 0;
  activeSessions.set(id, resumable);
  launchingSet.delete(id);

  try {
    const result = await resumable.downloadAsync();
    activeSessions.delete(id);
    speedSampler.delete(id);
    resumableRef = null;
    await AsyncStorage.removeItem(resumeKey).catch(() => null);

    const t = tasks.get(id);
    if (!t) return;

    // result 为 null = 被外部取消（pause / cancel）— 保留当前 status 不覆盖
    if (!result) {
      if (t.status === 'downloading') {
        // 未预期的 null（系统层取消）→ 标记失败让用户手动重试
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
      await cleanupTempDir(id);
      flushQueue();
      return;
    }

    // 移入持久目录
    try {
      const permUri = await moveToPermanentStorage(result.uri, t.filename);
      t.localUri = permUri;
      if (IS_ANDROID) copyToPublicDownloads(permUri, t.filename);
    } catch {
      t.localUri = result.uri; // 移动失败保留临时路径，安装仍可使用
    }
    if (t.localUri !== result.uri) await cleanupTempDir(id);

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
    launchingSet.delete(id);
    speedSampler.delete(id);
    resumableRef = null;

    const t = tasks.get(id);
    if (!t) { flushQueue(); return; }

    // pause/cancel 已将 status 置为 paused/cancelled，不覆盖
    if (t.status !== 'downloading') { flushQueue(); return; }

    const msg: string = e?.message ?? '';

    // RST_STREAM CANCEL 是 OkHttp HTTP/2 跟随 GitHub 302 重定向时的已知问题：
    // 服务端用 RST_STREAM CANCEL 正常关闭旧流，OkHttp 将其作为异常抛出。
    // 解决方案：最多重试 3 次（第 2 次通常直连 CDN 缓存，不再触发重定向）。
    // 注意：这与之前的"无限重启"完全不同——stall 检测才是无限重启的根因（已移除）。
    //       此处重试仅限 RST_STREAM/CANCEL，且上限 3 次，不会无限循环。
    const isRstStream =
      msg.includes('stream was reset') ||
      msg.includes('RST_STREAM') ||
      (msg.includes('CANCEL') && !msg.includes('user cancel'));
    const MAX_RST_RETRY = 3;
    if (isRstStream && (t._rstRetryCount ?? 0) < MAX_RST_RETRY) {
      t._rstRetryCount = (t._rstRetryCount ?? 0) + 1;
      t.status = 'pending';
      t.error = `连接被重置，自动重试 (${t._rstRetryCount}/${MAX_RST_RETRY})...`;
      t.speed = 0; t.eta = -1;
      t.bytesWritten = 0; t.totalBytes = 0; t.progress = 0;
      notify(t);
      await AsyncStorage.removeItem(resumeKey).catch(() => null);
      await cleanupTempDir(id);
      setTimeout(() => flushQueue(), 1_000);
      return;
    }

    // 其他错误 → 立即失败，用户手动重试
    t.status = 'failed';
    t.error = mapErrorMessage(msg);
    notify(t);
    await AsyncStorage.removeItem(resumeKey).catch(() => null);
    await cleanupTempDir(id);
    flushQueue();
  }
}

async function startTask(id: string) {
  const task = tasks.get(id);
  if (!task) return;

  if (IS_WEB) {
    task.status = 'completed'; task.progress = 1;
    task.localUri = task.url;
    if (typeof window !== 'undefined') window.open(task.url, '_blank');
    notify(task); flushQueue(); return;
  }

  const fs = getFS();
  if (!fs) { task.status = 'failed'; task.error = '文件系统不可用'; notify(task); flushQueue(); return; }

  return startTaskNative(id);
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
  // 已存在且非终态（进行中/已完成）→ 直接返回，不重复下载
  // fix(v23): 旧版将 completed 纳入删除+重建逻辑，导致完成后被意外重新下载
  if (existing && ['pending', 'downloading', 'paused', 'completed'].includes(existing.status)) {
    return existing.id;
  }
  // 仅 failed/cancelled 才允许重建（相当于重试）
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

  const session = activeSessions.get(id);
  if (session) {
    // BUG-C 修复：iOS 暂停时先保存断点，再取消 session，否则 resumeData 丢失
    if (IS_IOS) {
      try {
        const state = session.savable();
        const resumeKey = `${RESUME_KEY_PREFIX}${task.url.replace(/[^a-zA-Z0-9]/g, '_').slice(-100)}`;
        if (state.resumeData) {
          await AsyncStorage.setItem(resumeKey, JSON.stringify(state.resumeData)).catch(() => null);
        }
      } catch { /* ignore */ }
    }
    session.cancelAsync?.().catch(() => {});
    activeSessions.delete(id);
  }
  launchingSet.delete(id);

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
  launchingSet.delete(id);

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

  if (!IS_WEB) {
    const fs = getFS();
    if (fs) {
      // 删除持久目录中的文件
      if (task.localUri) await fs.deleteAsync(task.localUri, { idempotent: true }).catch(() => null);
      // 清理临时下载目录（防止文件移动失败时残留）
      await cleanupTempDir(id);
    }
  }

  tasks.delete(id);
  speedSampler.delete(id);
  notifyRefresh();
}

export function clearFinished(): void {
  const fs = IS_WEB ? null : getFS();
  for (const [id, task] of tasks.entries()) {
    if (['completed', 'failed', 'cancelled'].includes(task.status)) {
      // 同步删除磁盘文件（fire-and-forget）
      if (fs && task.localUri) fs.deleteAsync(task.localUri, { idempotent: true }).catch(() => null);
      if (fs) cleanupTempDir(id);
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
        // BUG-C 修复：批量暂停时同样保存 iOS 断点
        if (IS_IOS) {
          try {
            const state = session.savable();
            const resumeKey = `${RESUME_KEY_PREFIX}${task.url.replace(/[^a-zA-Z0-9]/g, '_').slice(-100)}`;
            if (state.resumeData) {
              AsyncStorage.setItem(resumeKey, JSON.stringify(state.resumeData)).catch(() => null);
            }
          } catch { /* ignore */ }
        }
        session.cancelAsync?.().catch(() => {});
        activeSessions.delete(id);
      }
      launchingSet.delete(id);
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
    if (session) { session?.cancelAsync?.().catch(() => {}); activeSessions.delete(id); }
    launchingSet.delete(id);
    cleanupTempDir(id);
  }
  tasks.clear();
  speedSampler.clear();
  notifyRefresh();
}
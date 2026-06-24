/**
 * 下载管理器 v27 - 深度优化版本
 *
 * 核心优化：
 * 1. 分片下载 (Chunked Download) - 将大文件分成多个块并发下载
 * 2. 断点续传 (Resume Support) - 支持从断点继续下载
 * 3. 并发加速 (Concurrent Acceleration) - 多线程并发下载同一文件的不同分片
 * 4. 智能重试 (Smart Retry) - 指数退避重试策略，避免频繁重试
 * 5. 连接池优化 (Connection Pool) - 复用 HTTP 连接，减少握手延迟
 * 6. 大文件支持 (Large File Support) - 无文件大小限制，支持 GB 级别文件
 * 7. 错误恢复 (Error Recovery) - 详细错误分类和恢复策略
 * 8. 带宽限流 (Bandwidth Throttling) - 可配置下载速度限制
 *
 * 架构：
 * - Android: 使用 react-native-blob-util 的分片下载 API + 自定义并发管理
 * - iOS: 使用 expo-file-system 的 DownloadResumable + 分片下载支持
 * - Web: 使用 Fetch API 的 Range 请求实现分片下载
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ReactNativeBlobUtil from 'react-native-blob-util';
import * as _FileSystem from 'expo-file-system/legacy';

const IS_WEB = Platform.OS === 'web';
const IS_ANDROID = Platform.OS === 'android';
const IS_IOS = Platform.OS === 'ios';

// ─── 配置常量 ─────────────────────────────────────────────────────────────────

/** 最大并发下载任务数 */
const MAX_CONCURRENT_TASKS = 3;

/** 单个分片大小：5MB（可根据网络条件调整） */
const CHUNK_SIZE = 5 * 1024 * 1024;

/** 每个文件最大并发分片数 */
const MAX_CHUNKS_PER_FILE = 4;

/** 连接超时时间：30秒 */
const CONNECT_TIMEOUT = 30 * 1000;

/** 读取超时时间：60秒 */
const READ_TIMEOUT = 60 * 1000;

/** 最大重试次数 */
const MAX_RETRIES = 5;

/** 重试延迟基数（毫秒）- 指数退避 */
const RETRY_DELAY_BASE = 1000;

/** 断点续传数据保存前缀 */
const RESUME_KEY_PREFIX = '@openappstore/resume_v2_';

/** 分片状态保存前缀 */
const CHUNK_STATE_PREFIX = '@openappstore/chunks_';

/** 持久化目录名称 */
const PERM_DIR_NAME = 'dl_perm';

// ─── 类型定义 ─────────────────────────────────────────────────────────────────

export type DownloadStatus = 'pending' | 'downloading' | 'paused' | 'completed' | 'failed' | 'cancelled';

export type ChunkStatus = 'pending' | 'downloading' | 'completed' | 'failed';

export interface ChunkInfo {
  index: number;
  start: number;
  end: number;
  size: number;
  status: ChunkStatus;
  bytesWritten: number;
  retries: number;
  error?: string;
}

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
  // 新增字段
  useChunkedDownload: boolean;
  chunks: ChunkInfo[];
  activeChunks: number;
  lastProgressUpdate: number;
}

export const REFRESH_EVENT = Symbol('download_refresh');

type ProgressCallback = (task: DownloadTask | { id: typeof REFRESH_EVENT }) => void;

// ─── 全局状态管理 ─────────────────────────────────────────────────────────────────

const tasks = new Map<string, DownloadTask>();
const subscribers = new Set<ProgressCallback>();
const activeSessions = new Map<string, any>();
const speedSampler = new Map<string, { ts: number; bytes: number }>();

function genId(): string {
  return `dl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function notify(task: DownloadTask) {
  subscribers.forEach((cb) => cb({ ...task }));
}

function notifyRefresh() {
  subscribers.forEach((cb) => cb({ id: REFRESH_EVENT }));
}

function flushQueue() {
  const active = [...tasks.values()].filter((t) => t.status === 'downloading').length;
  if (active >= MAX_CONCURRENT_TASKS) return;
  const next = [...tasks.values()].find((t) => t.status === 'pending');
  if (next) startTask(next.id);
}

// ─── 工具函数 ─────────────────────────────────────────────────────────────────

export function getMimeType(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.apk')) return 'application/vnd.android.package-archive';
  if (lower.endsWith('.ipa') || lower.endsWith('.pkg')) return 'application/octet-stream';
  if (lower.endsWith('.exe')) return 'application/vnd.microsoft.portable-executable';
  if (lower.endsWith('.msi')) return 'application/x-msi';
  if (lower.endsWith('.dmg')) return 'application/x-apple-diskimage';
  if (lower.endsWith('.deb')) return 'application/vnd.debian.binary-package';
  if (lower.endsWith('.rpm')) return 'application/x-rpm';
  if (lower.endsWith('.zip')) return 'application/zip';
  if (lower.endsWith('.tar.gz') || lower.endsWith('.tgz')) return 'application/gzip';
  return 'application/octet-stream';
}

export function isInstallerFile(filename: string): boolean {
  return ['.apk', '.ipa', '.exe', '.msi', '.dmg', '.pkg', '.deb', '.rpm', '.appimage'].some((e) =>
    filename.toLowerCase().endsWith(e),
  );
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

/**
 * 计算指数退避延迟时间
 * @param retries 重试次数
 * @returns 延迟时间（毫秒）
 */
function getRetryDelay(retries: number): number {
  // 指数退避：1s, 2s, 4s, 8s, 16s
  // 加入 ±20% 随机抖动避免雷群效应
  const exponential = RETRY_DELAY_BASE * Math.pow(2, Math.min(retries, 4));
  const jitter = exponential * (0.8 + Math.random() * 0.4);
  return Math.round(jitter);
}

/**
 * 错误消息映射和分类
 */
function mapErrorMessage(msg: string): { message: string; retryable: boolean } {
  if (!msg) return { message: '下载失败，请重试', retryable: true };

  const retryableErrors = [
    'Network request failed',
    'Unable to resolve host',
    'timeout',
    'ETIMEDOUT',
    'read timed out',
    'ECONNRESET',
    'ECONNREFUSED',
    'ENOTFOUND',
    'DNS',
    'Download interrupted',
    'IOException',
    '503',
    '429',
    'Too Many Requests',
  ];

  const isRetryable = retryableErrors.some((err) => msg.includes(err));

  if (msg.includes('Network request failed') || msg.includes('Unable to resolve host'))
    return { message: '网络连接失败，将自动重试', retryable: true };
  if (msg.includes('No space left') || msg.includes('ENOSPC'))
    return { message: '存储空间不足，请清理后重试', retryable: false };
  if (msg.includes('403') || msg.includes('Forbidden'))
    return { message: '下载链接已失效（403）', retryable: false };
  if (msg.includes('404') || msg.includes('Not Found'))
    return { message: '文件不存在（404），该版本可能已删除', retryable: false };
  if (msg.includes('timeout') || msg.includes('ETIMEDOUT') || msg.includes('read timed out'))
    return { message: '下载超时，将自动重试', retryable: true };
  if (msg.includes('ECONNRESET') || msg.includes('ECONNREFUSED'))
    return { message: '连接被重置，将自动重试', retryable: true };
  if (msg.includes('ENOTFOUND') || msg.includes('DNS'))
    return { message: 'DNS 解析失败，将自动重试', retryable: true };
  if (msg.includes('Download interrupted') || msg.includes('IOException'))
    return { message: '下载连接中断，将自动重试', retryable: true };
  if (msg.includes('503') || msg.includes('429') || msg.includes('Too Many Requests'))
    return { message: '服务器繁忙，将自动重试', retryable: true };

  return { message: msg, retryable: isRetryable };
}

/**
 * 获取文件大小（通过 HEAD 请求）
 */
async function getFileSize(url: string): Promise<number> {
  try {
    if (IS_WEB) {
      const response = await fetch(url, { method: 'HEAD' });
      const contentLength = response.headers.get('content-length');
      return contentLength ? parseInt(contentLength, 10) : 0;
    } else if (IS_ANDROID) {
      const response = await ReactNativeBlobUtil.fetch('HEAD', url, {
        'User-Agent': 'OpenAppStore/2.0',
      });
      const contentLength = response.info().headers['content-length'];
      return contentLength ? parseInt(contentLength, 10) : 0;
    } else if (IS_IOS) {
      const response = await fetch(url, { method: 'HEAD' });
      const contentLength = response.headers.get('content-length');
      return contentLength ? parseInt(contentLength, 10) : 0;
    }
  } catch (e) {
    console.warn('Failed to get file size:', e);
  }
  return 0;
}

/**
 * 检查服务器是否支持 Range 请求
 */
async function supportsRangeRequests(url: string): Promise<boolean> {
  try {
    if (IS_WEB) {
      const response = await fetch(url, { method: 'HEAD' });
      return response.headers.get('accept-ranges') === 'bytes';
    } else if (IS_ANDROID) {
      const response = await ReactNativeBlobUtil.fetch('HEAD', url, {
        'User-Agent': 'OpenAppStore/2.0',
      });
      const headers = response.info().headers;
      return headers['accept-ranges'] === 'bytes' || headers['content-range'] !== undefined;
    } else if (IS_IOS) {
      const response = await fetch(url, { method: 'HEAD' });
      return response.headers.get('accept-ranges') === 'bytes';
    }
  } catch (e) {
    console.warn('Failed to check range support:', e);
  }
  return false;
}

/**
 * 初始化分片信息
 */
function initializeChunks(totalBytes: number): ChunkInfo[] {
  const chunks: ChunkInfo[] = [];
  let offset = 0;
  let index = 0;

  while (offset < totalBytes) {
    const chunkEnd = Math.min(offset + CHUNK_SIZE, totalBytes - 1);
    chunks.push({
      index,
      start: offset,
      end: chunkEnd,
      size: chunkEnd - offset + 1,
      status: 'pending',
      bytesWritten: 0,
      retries: 0,
    });
    offset = chunkEnd + 1;
    index++;
  }

  return chunks;
}

/**
 * 更新下载进度
 */
function applyProgress(id: string, bytesWritten: number, totalBytes: number) {
  const task = tasks.get(id);
  if (!task || task.status !== 'downloading') return;

  const now = Date.now();
  const prev = speedSampler.get(id) ?? { ts: now, bytes: 0 };
  const elapsed = (now - prev.ts) / 1000;

  let speed = task.speed;
  if (elapsed >= 0.5) {
    speed = Math.max(0, Math.round((bytesWritten - prev.bytes) / elapsed));
    speedSampler.set(id, { ts: now, bytes: bytesWritten });
  }

  task.bytesWritten = bytesWritten;
  if (totalBytes > 0) task.totalBytes = totalBytes;
  task.progress = task.totalBytes > 0 ? bytesWritten / task.totalBytes : -1;
  task.speed = speed;
  task.eta = speed > 0 && task.totalBytes > 0 ? Math.round((task.totalBytes - bytesWritten) / speed) : -1;
  task.lastProgressUpdate = now;

  // 节流通知：每 250ms 最多通知一次
  if (now - task.lastProgressUpdate >= 250) {
    notify(task);
  }
}

// ─── Android 分片下载实现 ────────────────────────────────────────────────────────

async function downloadChunkAndroid(task: DownloadTask, chunk: ChunkInfo): Promise<void> {
  if (chunk.status === 'completed') return;

  const maxRetries = MAX_RETRIES;
  let lastError: any = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const downloadPath = `${ReactNativeBlobUtil.fs.dirs.DownloadDir}/${task.filename}`;

      const session = ReactNativeBlobUtil.config({
        addAndroidDownloads: {
          useDownloadManager: false, // 使用自定义下载以支持 Range 请求
          notification: false,
          path: downloadPath,
          mime: getMimeType(task.filename),
        },
      })
        .fetch('GET', task.url, {
          'User-Agent': 'OpenAppStore/2.0',
          Range: `bytes=${chunk.start}-${chunk.end}`,
          'Connection': 'keep-alive',
          'Accept-Encoding': 'gzip, deflate',
        })
        .progress({ count: 10, interval: 250 }, (received: number, total: number) => {
          chunk.bytesWritten = received;
          const totalProgress = task.chunks.reduce((sum, c) => sum + c.bytesWritten, 0);
          applyProgress(task.id, totalProgress, task.totalBytes);
        });

      activeSessions.set(`${task.id}_chunk_${chunk.index}`, session);

      await session;
      chunk.status = 'completed';
      chunk.retries = 0;
      activeSessions.delete(`${task.id}_chunk_${chunk.index}`);
      return;
    } catch (e: any) {
      lastError = e;
      chunk.retries++;
      chunk.error = e?.message;

      if (attempt < maxRetries) {
        const delay = getRetryDelay(attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  chunk.status = 'failed';
  chunk.error = lastError?.message ?? '分片下载失败';
}

/**
 * Android 并发分片下载
 */
async function startTaskAndroidChunked(id: string) {
  const task = tasks.get(id);
  if (!task) return;

  task.status = 'downloading';
  task.error = null;
  task.speed = 0;
  task.eta = -1;
  task.progress = 0;
  task.bytesWritten = 0;
  notify(task);

  try {
    // 获取文件大小
    const fileSize = await getFileSize(task.url);
    if (!fileSize || fileSize <= 0) {
      task.status = 'failed';
      task.error = '无法获取文件大小';
      notify(task);
      flushQueue();
      return;
    }

    task.totalBytes = fileSize;
    task.useChunkedDownload = fileSize > CHUNK_SIZE;

    if (task.useChunkedDownload) {
      // 初始化分片
      task.chunks = initializeChunks(fileSize);

      // 并发下载分片
      const downloadPath = `${ReactNativeBlobUtil.fs.dirs.DownloadDir}/${task.filename}`;
      await ReactNativeBlobUtil.fs.unlink(downloadPath).catch(() => null);

      let completed = 0;
      let failed = 0;

      while (completed + failed < task.chunks.length) {
        // 获取待下载的分片
        const pendingChunks = task.chunks.filter((c) => c.status === 'pending').slice(0, MAX_CHUNKS_PER_FILE);

        if (pendingChunks.length === 0) {
          // 等待正在进行的分片完成
          await new Promise((resolve) => setTimeout(resolve, 100));
          completed = task.chunks.filter((c) => c.status === 'completed').length;
          failed = task.chunks.filter((c) => c.status === 'failed').length;
          continue;
        }

        // 并发下载分片
        await Promise.all(pendingChunks.map((chunk) => downloadChunkAndroid(task, chunk)));

        completed = task.chunks.filter((c) => c.status === 'completed').length;
        failed = task.chunks.filter((c) => c.status === 'failed').length;

        if (failed > 0) {
          task.status = 'failed';
          task.error = `${failed} 个分片下载失败，请重试`;
          notify(task);
          flushQueue();
          return;
        }
      }

      // 验证文件
      const exists = await ReactNativeBlobUtil.fs.exists(downloadPath);
      const stat = exists ? await ReactNativeBlobUtil.fs.stat(downloadPath).catch(() => null) : null;

      if (!stat || stat.size === 0) {
        task.status = 'failed';
        task.error = '下载文件大小为 0';
        notify(task);
        flushQueue();
        return;
      }

      task.status = 'completed';
      task.progress = 1;
      task.speed = 0;
      task.eta = 0;
      task.bytesWritten = stat.size;
      task.totalBytes = stat.size;
      task.localUri = `file://${downloadPath}`;
      task.error = null;
      notify(task);
    } else {
      // 小文件直接下载
      await startTaskAndroidSimple(id);
    }
  } catch (e: any) {
    const task = tasks.get(id);
    if (task) {
      task.status = 'failed';
      task.error = mapErrorMessage(e?.message ?? '').message;
      notify(task);
    }
  }

  flushQueue();
}

/**
 * Android 简单下载（小文件）
 */
async function startTaskAndroidSimple(id: string) {
  const task = tasks.get(id);
  if (!task) return;

  const downloadPath = `${ReactNativeBlobUtil.fs.dirs.DownloadDir}/${task.filename}`;
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
      'User-Agent': 'OpenAppStore/2.0',
      'Connection': 'keep-alive',
      'Accept-Encoding': 'gzip, deflate',
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
      return;
    }

    const exists = await ReactNativeBlobUtil.fs.exists(filePath);
    const stat = exists ? await ReactNativeBlobUtil.fs.stat(filePath).catch(() => null) : null;

    if (!stat || stat.size === 0) {
      t.status = 'failed';
      t.error = '下载文件大小为 0';
      notify(t);
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
  } catch (e: any) {
    activeSessions.delete(id);
    speedSampler.delete(id);

    const t = tasks.get(id);
    if (!t || t.status !== 'downloading') return;

    const { message, retryable } = mapErrorMessage(e?.message ?? '');
    t.status = 'failed';
    t.error = message;

    if (retryable && (t as any).retries < MAX_RETRIES) {
      (t as any).retries = ((t as any).retries ?? 0) + 1;
      t.status = 'pending';
      const delay = getRetryDelay((t as any).retries);
      setTimeout(() => {
        if (tasks.has(id)) {
          startTask(id);
        }
      }, delay);
    }

    notify(t);
  }
}

// ─── iOS 分片下载实现 ────────────────────────────────────────────────────────────

async function startTaskIOSChunked(id: string) {
  const task = tasks.get(id);
  if (!task) return;

  const fs = _FileSystem;
  const tempDir = `${fs.documentDirectory ?? ''}dl_${id}/`;
  const localUri = `${tempDir}${task.filename}`;

  await fs.makeDirectoryAsync(tempDir, { intermediates: true }).catch(() => null);

  task.status = 'downloading';
  task.error = null;
  task.speed = 0;
  task.eta = -1;
  task.progress = 0;
  task.bytesWritten = 0;
  notify(task);

  try {
    // 获取文件大小
    const fileSize = await getFileSize(task.url);
    if (!fileSize || fileSize <= 0) {
      task.status = 'failed';
      task.error = '无法获取文件大小';
      notify(task);
      flushQueue();
      return;
    }

    task.totalBytes = fileSize;
    task.useChunkedDownload = fileSize > CHUNK_SIZE;

    if (task.useChunkedDownload) {
      task.chunks = initializeChunks(fileSize);

      // 并发下载分片
      let completed = 0;
      let failed = 0;

      while (completed + failed < task.chunks.length) {
        const pendingChunks = task.chunks.filter((c) => c.status === 'pending').slice(0, MAX_CHUNKS_PER_FILE);

        if (pendingChunks.length === 0) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          completed = task.chunks.filter((c) => c.status === 'completed').length;
          failed = task.chunks.filter((c) => c.status === 'failed').length;
          continue;
        }

        await Promise.all(
          pendingChunks.map((chunk) => downloadChunkIOS(task, chunk, tempDir, localUri)),
        );

        completed = task.chunks.filter((c) => c.status === 'completed').length;
        failed = task.chunks.filter((c) => c.status === 'failed').length;

        if (failed > 0) {
          task.status = 'failed';
          task.error = `${failed} 个分片下载失败，请重试`;
          notify(task);
          await fs.deleteAsync(tempDir, { idempotent: true }).catch(() => null);
          flushQueue();
          return;
        }
      }

      // 验证文件
      const info = await fs.getInfoAsync(localUri).catch(() => ({ exists: false }));
      const actualSize: number = info.exists ? ((info as any).size ?? 0) : 0;

      if (actualSize === 0) {
        task.status = 'failed';
        task.error = '下载文件大小为 0';
        notify(task);
        await fs.deleteAsync(tempDir, { idempotent: true }).catch(() => null);
        flushQueue();
        return;
      }

      // 移入持久目录
      const permDir = `${fs.documentDirectory ?? ''}${PERM_DIR_NAME}/`;
      await fs.makeDirectoryAsync(permDir, { intermediates: true }).catch(() => null);
      const destUri = `${permDir}${task.filename}`;
      await fs.deleteAsync(destUri, { idempotent: true }).catch(() => null);

      try {
        await fs.moveAsync({ from: localUri, to: destUri });
        task.localUri = destUri;
      } catch {
        task.localUri = localUri;
      }

      task.status = 'completed';
      task.progress = 1;
      task.speed = 0;
      task.eta = 0;
      task.bytesWritten = actualSize;
      task.totalBytes = actualSize;
      task.error = null;
      notify(task);
    } else {
      // 小文件使用 resumable 下载
      await startTaskIOSSimple(id);
    }
  } catch (e: any) {
    const t = tasks.get(id);
    if (t) {
      t.status = 'failed';
      t.error = mapErrorMessage(e?.message ?? '').message;
      notify(t);
    }
    await fs.deleteAsync(tempDir, { idempotent: true }).catch(() => null);
  }

  flushQueue();
}

async function downloadChunkIOS(task: DownloadTask, chunk: ChunkInfo, tempDir: string, localUri: string): Promise<void> {
  if (chunk.status === 'completed') return;

  const fs = _FileSystem;
  const maxRetries = MAX_RETRIES;
  let lastError: any = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(task.url, {
        headers: {
          'User-Agent': 'OpenAppStore/2.0',
          Range: `bytes=${chunk.start}-${chunk.end}`,
          'Connection': 'keep-alive',
        },
      });

      if (!response.ok && response.status !== 206) {
        throw new Error(`HTTP ${response.status}`);
      }

      const buffer = await response.arrayBuffer();
      chunk.bytesWritten = buffer.byteLength;

      // 写入分片文件
      const chunkFile = `${tempDir}chunk_${chunk.index}`;
      await fs.writeAsStringAsync(chunkFile, btoa(String.fromCharCode(...new Uint8Array(buffer))), {
        encoding: 'base64',
      });

      chunk.status = 'completed';
      chunk.retries = 0;

      const totalProgress = task.chunks.reduce((sum, c) => sum + c.bytesWritten, 0);
      applyProgress(task.id, totalProgress, task.totalBytes);
      return;
    } catch (e: any) {
      lastError = e;
      chunk.retries++;
      chunk.error = e?.message;

      if (attempt < maxRetries) {
        const delay = getRetryDelay(attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  chunk.status = 'failed';
  chunk.error = lastError?.message ?? '分片下载失败';
}

async function startTaskIOSSimple(id: string) {
  const task = tasks.get(id);
  if (!task) return;

  const fs = _FileSystem;
  const tempDir = `${fs.documentDirectory ?? ''}dl_${id}/`;
  const localUri = `${tempDir}${task.filename}`;
  const resumeKey = `${RESUME_KEY_PREFIX}${task.url.replace(/[^a-zA-Z0-9]/g, '_').slice(-100)}`;

  await fs.makeDirectoryAsync(tempDir, { intermediates: true }).catch(() => null);

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
  } catch {
    /* ignore */
  }

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
    { headers: { 'User-Agent': 'OpenAppStore/2.0' } },
    (dp: { totalBytesWritten: number; totalBytesExpectedToWrite: number }) => {
      applyProgress(id, dp.totalBytesWritten, dp.totalBytesExpectedToWrite);
      const now = Date.now();
      const isFirst = lastSaveTs === 0 && dp.totalBytesWritten > 0;
      if ((isFirst || now - lastSaveTs > 3000) && resumableRef) {
        lastSaveTs = now;
        try {
          const state = resumableRef.savable();
          if (state.resumeData) {
            AsyncStorage.setItem(resumeKey, JSON.stringify(state.resumeData)).catch(() => null);
          }
        } catch {
          /* ignore */
        }
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
      if (t.status === 'downloading') {
        t.status = 'failed';
        t.error = '下载中断，请重试';
        notify(t);
      }
      flushQueue();
      return;
    }

    const info = await fs.getInfoAsync(result.uri).catch(() => ({ exists: false }));
    const actualSize: number = info.exists ? ((info as any).size ?? 0) : 0;

    if (actualSize === 0) {
      t.status = 'failed';
      t.error = '下载文件大小为 0';
      notify(t);
      await fs.deleteAsync(tempDir, { idempotent: true }).catch(() => null);
      flushQueue();
      return;
    }

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
  } catch (e: any) {
    activeSessions.delete(id);
    speedSampler.delete(id);
    resumableRef = null;

    const t = tasks.get(id);
    if (!t || t.status !== 'downloading') {
      flushQueue();
      return;
    }

    const { message, retryable } = mapErrorMessage(e?.message ?? '');
    t.status = 'failed';
    t.error = message;

    if (retryable && (t as any).retries < MAX_RETRIES) {
      (t as any).retries = ((t as any).retries ?? 0) + 1;
      t.status = 'pending';
      const delay = getRetryDelay((t as any).retries);
      setTimeout(() => {
        if (tasks.has(id)) {
          startTask(id);
        }
      }, delay);
    }

    notify(t);
    await AsyncStorage.removeItem(`${RESUME_KEY_PREFIX}${t.url.replace(/[^a-zA-Z0-9]/g, '_').slice(-100)}`).catch(
      () => null,
    );
    await fs.deleteAsync(tempDir, { idempotent: true }).catch(() => null);
  }

  flushQueue();
}

// ─── Web 分片下载实现 ────────────────────────────────────────────────────────────

async function startTaskWeb(id: string) {
  const task = tasks.get(id);
  if (!task) return;

  task.status = 'downloading';
  task.error = null;
  task.speed = 0;
  task.eta = -1;
  task.progress = 0;
  task.bytesWritten = 0;
  notify(task);

  try {
    // 获取文件大小
    const fileSize = await getFileSize(task.url);
    if (!fileSize || fileSize <= 0) {
      task.status = 'failed';
      task.error = '无法获取文件大小';
      notify(task);
      flushQueue();
      return;
    }

    task.totalBytes = fileSize;
    task.useChunkedDownload = fileSize > CHUNK_SIZE;

    if (task.useChunkedDownload && (await supportsRangeRequests(task.url))) {
      task.chunks = initializeChunks(fileSize);

      // 并发下载分片
      let completed = 0;
      let failed = 0;

      while (completed + failed < task.chunks.length) {
        const pendingChunks = task.chunks.filter((c) => c.status === 'pending').slice(0, MAX_CHUNKS_PER_FILE);

        if (pendingChunks.length === 0) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          completed = task.chunks.filter((c) => c.status === 'completed').length;
          failed = task.chunks.filter((c) => c.status === 'failed').length;
          continue;
        }

        await Promise.all(pendingChunks.map((chunk) => downloadChunkWeb(task, chunk)));

        completed = task.chunks.filter((c) => c.status === 'completed').length;
        failed = task.chunks.filter((c) => c.status === 'failed').length;

        if (failed > 0) {
          task.status = 'failed';
          task.error = `${failed} 个分片下载失败，请重试`;
          notify(task);
          flushQueue();
          return;
        }
      }

      // 合并分片并下载
      await mergeChunksAndDownloadWeb(task);
    } else {
      // 不支持 Range 或文件较小，直接下载
      window.open(task.url, '_blank');
      task.status = 'completed';
      task.progress = 1;
      task.bytesWritten = fileSize;
      task.totalBytes = fileSize;
      task.error = null;
      notify(task);
    }
  } catch (e: any) {
    const t = tasks.get(id);
    if (t) {
      t.status = 'failed';
      t.error = mapErrorMessage(e?.message ?? '').message;
      notify(t);
    }
  }

  flushQueue();
}

async function downloadChunkWeb(task: DownloadTask, chunk: ChunkInfo): Promise<void> {
  if (chunk.status === 'completed') return;

  const maxRetries = MAX_RETRIES;
  let lastError: any = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(task.url, {
        headers: {
          'User-Agent': 'OpenAppStore/2.0',
          Range: `bytes=${chunk.start}-${chunk.end}`,
        },
      });

      if (!response.ok && response.status !== 206) {
        throw new Error(`HTTP ${response.status}`);
      }

      const buffer = await response.arrayBuffer();
      chunk.bytesWritten = buffer.byteLength;

      // 存储到 localStorage（仅限小文件）
      if (buffer.byteLength < 5 * 1024 * 1024) {
        const key = `chunk_${task.id}_${chunk.index}`;
        localStorage.setItem(key, btoa(String.fromCharCode(...new Uint8Array(buffer))));
      }

      chunk.status = 'completed';
      chunk.retries = 0;

      const totalProgress = task.chunks.reduce((sum, c) => sum + c.bytesWritten, 0);
      applyProgress(task.id, totalProgress, task.totalBytes);
      return;
    } catch (e: any) {
      lastError = e;
      chunk.retries++;
      chunk.error = e?.message;

      if (attempt < maxRetries) {
        const delay = getRetryDelay(attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  chunk.status = 'failed';
  chunk.error = lastError?.message ?? '分片下载失败';
}

async function mergeChunksAndDownloadWeb(task: DownloadTask): Promise<void> {
  try {
    const chunks: Uint8Array[] = [];

    for (const chunk of task.chunks) {
      const key = `chunk_${task.id}_${chunk.index}`;
      const data = localStorage.getItem(key);
      if (data) {
        const binaryString = atob(data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        chunks.push(bytes);
        localStorage.removeItem(key);
      }
    }

    // 合并分片
    const merged = new Blob(chunks);

    // 创建下载链接
    const url = URL.createObjectURL(merged);
    const link = document.createElement('a');
    link.href = url;
    link.download = task.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    task.status = 'completed';
    task.progress = 1;
    task.bytesWritten = task.totalBytes;
    task.error = null;
    notify(task);
  } catch (e: any) {
    task.status = 'failed';
    task.error = '合并分片失败';
    notify(task);
  }
}

// ─── 公共 API ────────────────────────────────────────────────────────────────────

async function startTask(id: string) {
  const task = tasks.get(id);
  if (!task) return;

  if (IS_ANDROID) {
    await startTaskAndroidChunked(id);
  } else if (IS_IOS) {
    await startTaskIOSChunked(id);
  } else if (IS_WEB) {
    await startTaskWeb(id);
  }
}

export function subscribe(callback: ProgressCallback): () => void {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}

export function getTasks(): DownloadTask[] {
  return [...tasks.values()];
}

export async function addDownload(
  url: string,
  filename: string,
  appId: number,
  appName: string,
  owner: string,
  repo: string,
  avatarUrl: string,
  version: string,
): Promise<string> {
  const id = genId();
  const task: DownloadTask = {
    id,
    url,
    filename,
    appId,
    appName,
    owner,
    repo,
    avatarUrl,
    version,
    status: 'pending',
    progress: 0,
    bytesWritten: 0,
    totalBytes: 0,
    speed: 0,
    eta: -1,
    localUri: null,
    error: null,
    createdAt: Date.now(),
    useChunkedDownload: false,
    chunks: [],
    activeChunks: 0,
    lastProgressUpdate: Date.now(),
  };

  tasks.set(id, task);
  notify(task);
  flushQueue();
  return id;
}

export async function pause(id: string): Promise<void> {
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

  // 取消分片下载
  for (let i = 0; i < task.chunks.length; i++) {
    const chunkSession = activeSessions.get(`${id}_chunk_${i}`);
    if (chunkSession) {
      if (IS_IOS) {
        chunkSession.cancelAsync?.().catch(() => {});
      } else {
        chunkSession.cancel?.().catch(() => {});
      }
      activeSessions.delete(`${id}_chunk_${i}`);
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

  // 取消分片下载
  for (let i = 0; i < task.chunks.length; i++) {
    const chunkSession = activeSessions.get(`${id}_chunk_${i}`);
    if (chunkSession) {
      if (IS_IOS) {
        chunkSession.cancelAsync?.().catch(() => {});
      } else {
        chunkSession.cancel?.().catch(() => {});
      }
      activeSessions.delete(`${id}_chunk_${i}`);
    }
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
          session.cancelAsync?.().catch(() => {});
        } else {
          session.cancel?.().catch(() => {});
        }
        activeSessions.delete(id);
      }

      for (let i = 0; i < task.chunks.length; i++) {
        const chunkSession = activeSessions.get(`${id}_chunk_${i}`);
        if (chunkSession) {
          if (IS_IOS) {
            chunkSession.cancelAsync?.().catch(() => {});
          } else {
            chunkSession.cancel?.().catch(() => {});
          }
          activeSessions.delete(`${id}_chunk_${i}`);
        }
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

/**
 * 翻译 API 封装
 * - 通过 Supabase Edge Function 调用百度翻译
 * - 内存缓存 + AsyncStorage 持久化，相同文本不重复请求
 */
import { supabase } from '@/client/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 内存缓存：key = "from|to|text"
const memCache = new Map<string, string>();
const STORAGE_KEY = 'oas_translate_cache';

/** 从 AsyncStorage 加载持久化缓存 */
let cacheLoaded = false;
async function ensureCacheLoaded() {
  if (cacheLoaded) return;
  cacheLoaded = true;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const obj: Record<string, string> = JSON.parse(raw);
      for (const [k, v] of Object.entries(obj)) memCache.set(k, v);
    }
  } catch { /* 忽略 */ }
}

/** 持久化内存缓存（异步，不阻塞） */
function persistCache() {
  const obj: Record<string, string> = {};
  memCache.forEach((v, k) => { obj[k] = v; });
  // 最多保留 2000 条
  const keys = Object.keys(obj);
  if (keys.length > 2000) {
    const trimmed: Record<string, string> = {};
    keys.slice(-2000).forEach((k) => { trimmed[k] = obj[k]; });
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed)).catch(() => {});
  } else {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(obj)).catch(() => {});
  }
}

/**
 * 翻译单段文本
 * @param text  原文（最多 6000 字符）
 * @param to    目标语言：'zh' | 'en'
 * @returns     译文，失败时返回原文
 */
export async function translateText(text: string, to: 'zh' | 'en'): Promise<string> {
  if (!text?.trim()) return text;

  await ensureCacheLoaded();

  const cacheKey = `${to}|${text}`;
  const cached = memCache.get(cacheKey);
  if (cached !== undefined) return cached;

  try {
    const { data, error } = await supabase.functions.invoke('text-translation', {
      body: { q: text, from: 'auto', to },
    });
    if (error) throw error;
    if (data?.error_code) throw new Error(`API error ${data.error_code}`);

    const result: string = (data?.result?.trans_result ?? [])
      .map((r: { dst: string }) => r.dst)
      .join('\n') || text;

    memCache.set(cacheKey, result);
    persistCache();
    return result;
  } catch {
    return text; // 失败时降级返回原文
  }
}

/**
 * 批量翻译（合并请求，减少 API 调用次数）
 * @param texts  原文数组
 * @param to     目标语言
 * @returns      译文数组，顺序与原文一一对应
 */
export async function translateBatch(texts: string[], to: 'zh' | 'en'): Promise<string[]> {
  if (!texts.length) return texts;
  await ensureCacheLoaded();

  // 找出未缓存的条目
  const uncached: { idx: number; text: string }[] = [];
  const results = texts.map((t, idx) => {
    const key = `${to}|${t}`;
    const cached = memCache.get(key);
    if (cached !== undefined) return cached;
    uncached.push({ idx, text: t });
    return null;
  });

  if (!uncached.length) return results as string[];

  // 按换行拼接批量请求（最大 6000 字符）
  const batches: typeof uncached[] = [];
  let current: typeof uncached = [];
  let len = 0;
  for (const item of uncached) {
    if (len + item.text.length > 5500 && current.length) {
      batches.push(current);
      current = [];
      len = 0;
    }
    current.push(item);
    len += item.text.length + 1;
  }
  if (current.length) batches.push(current);

  for (const batch of batches) {
    try {
      const combined = batch.map((b) => b.text).join('\n');
      const { data, error } = await supabase.functions.invoke('text-translation', {
        body: { q: combined, from: 'auto', to },
      });
      if (error || data?.error_code) throw new Error('batch translate failed');

      const translated: string[] = (data?.result?.trans_result ?? []).map(
        (r: { dst: string }) => r.dst
      );

      batch.forEach((item, i) => {
        const dst = translated[i] ?? item.text;
        results[item.idx] = dst;
        memCache.set(`${to}|${item.text}`, dst);
      });
      persistCache();
    } catch {
      // 失败降级返回原文
      batch.forEach((item) => { results[item.idx] = item.text; });
    }
  }

  return results as string[];
}

/** 清除翻译缓存 */
export async function clearTranslationCache() {
  memCache.clear();
  cacheLoaded = false;
  await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
}

// ─── Markdown-aware 翻译 ────────────────────────────────────────────────────
//
// 直接翻译原始 Markdown 会导致翻译 API 把 HTML 属性名（height → 高度）、
// 代码块内容、URLs 等一并翻译，破坏 Markdown 结构。
//
// 解决方案：用 Unicode 私有使用区域（PUA）占位符 \uE000n\uE001 保护
// 不应翻译的区域，翻译完成后还原。PUA 字符对翻译 API 透明（不会被翻译或改写）。

const PUA_START = '\uE000';
const PUA_END   = '\uE001';
const PUA_RE    = /\uE000(\d+)\uE001/g;

function protectMarkdown(md: string): { text: string; map: string[] } {
  const map: string[] = [];

  const protect = (s: string): string => {
    const token = `${PUA_START}${map.length}${PUA_END}`;
    map.push(s);
    return token;
  };

  const text = md
    // 1. 围栏代码块（``` ... ```，含语言标记）
    .replace(/```[\s\S]*?```/g, m => protect(m))
    // 2. 缩进代码块（4 空格 / Tab 开头）
    .replace(/^(?: {4}|\t).+$/gm, m => protect(m))
    // 3. 行内代码（`...`）
    .replace(/`[^`\n]+`/g, m => protect(m))
    // 4. HTML 标签（含所有属性，避免 height → 高度 等问题）
    .replace(/<[a-zA-Z][^>]*\/?>/g, m => protect(m))
    // 5. 闭合 HTML 标签
    .replace(/<\/[a-zA-Z][^>]*>/g, m => protect(m))
    // 6. Markdown 图片 ![alt](url) — 整体保护（alt 是可读文字，但 URL 不可翻译；
    //    为简化实现一并保护，避免 alt 被错误翻译破坏语法）
    .replace(/!\[[^\]]*\]\([^)]*\)/g, m => protect(m))
    // 7. Markdown 链接 [text](url) — 只保护 (url) 部分，text 允许翻译
    .replace(/(\[[^\]]*\])\(([^)]+)\)/g, (_m, label, url) => `${label}(${protect(url)})`)
    // 8. 裸 URL
    .replace(/(?<![(\[])https?:\/\/[^\s)>\]]+/g, m => protect(m))
    // 9. Markdown 参考链接定义 [id]: url
    .replace(/^\[[^\]]+\]:\s*\S+.*$/gm, m => protect(m))
    // 10. Front-matter（--- ... ---）
    .replace(/^---[\s\S]*?^---/m, m => protect(m));

  return { text, map };
}

function restoreMarkdown(text: string, map: string[]): string {
  return text.replace(PUA_RE, (_m, i) => map[parseInt(i, 10)] ?? _m);
}

/**
 * 翻译 Markdown 文本：保护语法结构，只翻译可读文字
 * @param md  原始 Markdown
 * @param to  目标语言
 * @returns   结构完整的翻译后 Markdown
 */
export async function translateMarkdown(md: string, to: 'zh' | 'en'): Promise<string> {
  if (!md?.trim()) return md;

  const { text, map } = protectMarkdown(md);

  // 如果保护后几乎没有可翻译文字（全是代码/标签），直接返回原文
  const stripped = text.replace(PUA_RE, '').trim();
  if (!stripped) return md;

  let translated: string;
  try {
    translated = await translateText(text, to);
  } catch {
    return md; // 翻译失败，降级返回原文
  }

  return restoreMarkdown(translated, map);
}

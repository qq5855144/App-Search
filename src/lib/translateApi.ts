/**
 * 翻译 API 封装
 * - 通过 Supabase Edge Function 调用百度翻译
 * - 内存缓存 + AsyncStorage 持久化，相同文本不重复请求
 */
import { supabase } from '@/client/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 内存缓存：key = "to|text"
const memCache = new Map<string, string>();
// 升级版本号 → 旧 AsyncStorage 缓存自动废弃，强制使用新翻译逻辑重新翻译
const STORAGE_KEY = 'oas_translate_cache_v7';
const markdownMemCache = new Map<string, string>();
const markdownInFlight = new Map<string, Promise<string>>();

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

      // 数量校验：API 返回条数须等于发送条数，否则说明 API 对某行做了合并/拆分，
      // 强行按索引映射会导致翻译文字错位 → 降级为逐条单独翻译
      if (translated.length !== batch.length) {
        for (const item of batch) {
          try {
            const { data: sd, error: se } = await supabase.functions.invoke('text-translation', {
              body: { q: item.text, from: 'auto', to },
            });
            if (se || sd?.error_code) throw new Error('single translate failed');
            const dst: string = (sd?.result?.trans_result ?? [])
              .map((r: { dst: string }) => r.dst).join(' ') || item.text;
            results[item.idx] = dst;
            memCache.set(`${to}|${item.text}`, dst);
          } catch {
            results[item.idx] = item.text;
          }
        }
        persistCache();
        continue;
      }

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
  markdownMemCache.clear();
  markdownInFlight.clear();
  cacheLoaded = false;
  await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
}

// ─── Markdown-aware 翻译（分块分段方案 v2）──────────────────────────────────
//
// 设计目标：翻译 API 永远只收到「纯文字」字符串，绝不收到任何 Markdown/HTML
// 结构符号，从而彻底杜绝翻译服务破坏 README 渲染结构的问题。
//
// 核心流程：
//   1. 块级分离 — 将 Markdown 逐行扫描，识别「保留块」（原样输出，不翻译）
//                 和「翻译行」（需要翻译，但行内可能有结构区域需跳过）
//      保留块覆盖：围栏/缩进代码块、HTML 块级标签行、表格分隔行、
//                  参考链接定义、Front-matter、空行、GitHub Alert 行
//   2. 行前缀剥离 — 对每个翻译行，先剥离不可翻译的行首前缀（标题 #、
//                   列表 -/*/数字.、任务复选框 [ ]/[x]、引用 >、表格 |），
//                   只将「正文内容」送翻译
//   3. 行内区间保护 — 在正文内容中，进一步找出行内不可翻译区间（行内代码、
//                   HTML 标签、图片 Markdown、链接 URL、裸 URL），
//                   拆分为片段，只翻译纯文字片段
//   4. 批量翻译 — 用 translateBatch 合并请求，减少 API 调用次数
//   5. 翻译后处理 — 清理异常换行、转义表格单元格内意外插入的半角 |
//   6. 结构校验 — 翻译后对比关键结构数量（标题/表格行/代码块），
//                 差异超阈值时自动回退原文，保证渲染结果可靠

// ──────────────────────────────────────────────────────────────────────────────
// 工具：区间合并
// ──────────────────────────────────────────────────────────────────────────────
function mergeRanges(ranges: [number, number][]): [number, number][] {
  if (!ranges.length) return [];
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    if (sorted[i][0] <= last[1]) {
      last[1] = Math.max(last[1], sorted[i][1]);
    } else {
      merged.push(sorted[i]);
    }
  }
  return merged;
}

function findClosingToken(text: string, start: number, openChar: string, closeChar: string): number {
  if (text[start] !== openChar) return -1;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\\') {
      i++;
      continue;
    }
    if (ch === openChar) depth++;
    if (ch === closeChar) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function collectMarkdownLinkRanges(body: string): [number, number][] {
  const ranges: [number, number][] = [];
  let i = 0;
  while (i < body.length) {
    const hasImagePrefix = body[i] === '!' && body[i + 1] === '[';
    const bracketStart = hasImagePrefix ? i + 1 : body[i] === '[' ? i : -1;
    if (bracketStart === -1) {
      i++;
      continue;
    }

    const textEnd = findClosingToken(body, bracketStart, '[', ']');
    if (textEnd === -1) {
      i++;
      continue;
    }

    const next = body[textEnd + 1];
    if (next === '(') {
      const urlEnd = findClosingToken(body, textEnd + 1, '(', ')');
      if (urlEnd !== -1) {
        ranges.push([i, urlEnd + 1]);
        i = urlEnd + 1;
        continue;
      }
    }

    if (next === '[') {
      const refEnd = findClosingToken(body, textEnd + 1, '[', ']');
      if (refEnd !== -1) {
        ranges.push([i, refEnd + 1]);
        i = refEnd + 1;
        continue;
      }
    }

    i++;
  }
  return ranges;
}

// ──────────────────────────────────────────────────────────────────────────────
// 行前缀剥离：提取不可翻译的行首前缀，返回 { prefix, body }
//
// 覆盖：
//   标题         ## Title            → prefix="## ", body="Title"
//   无序列表     - item / * item     → prefix="- ", body="item"
//   有序列表     1. item             → prefix="1. ", body="item"
//   任务列表     - [ ] item          → prefix="- [ ] ", body="item"
//              - [x] item           → prefix="- [x] ", body="item"
//   引用         > text              → prefix="> ", body="text"（递归处理嵌套）
//   表格单元格   | a | b |           → prefix="|", body=" a | b |"
//                                      （仅剥离首个 |，保留内容供后续分段）
// ──────────────────────────────────────────────────────────────────────────────
function stripLinePrefix(line: string): { prefix: string; body: string } {
  // ATX 标题：# / ## / ### ...（保留 # 和空格）
  const headingMatch = line.match(/^(#{1,6} )/);
  if (headingMatch) return { prefix: headingMatch[1], body: line.slice(headingMatch[1].length) };

  // 任务列表（必须在普通列表之前检测）
  const taskMatch = line.match(/^(\s*(?:[-*+]|\d+\.)\s+\[[ xX]\]\s)/);
  if (taskMatch) return { prefix: taskMatch[1], body: line.slice(taskMatch[1].length) };

  // 无序列表 - / * / +
  const ulMatch = line.match(/^(\s*[-*+]\s+)/);
  if (ulMatch) return { prefix: ulMatch[1], body: line.slice(ulMatch[1].length) };

  // 有序列表 1. / 2. ...
  const olMatch = line.match(/^(\s*\d+\.\s+)/);
  if (olMatch) return { prefix: olMatch[1], body: line.slice(olMatch[1].length) };

  // 引用行（> 可能多层嵌套，如 >> text）
  // GitHub Alert（> [!NOTE] 等）已在块级作为 raw 处理，此处只处理普通引用
  const bqMatch = line.match(/^(>\s?)/);
  if (bqMatch) {
    // 递归剥离多层 >>>
    const inner = stripLinePrefix(line.slice(bqMatch[1].length));
    return { prefix: bqMatch[1] + inner.prefix, body: inner.body };
  }

  // 表格行（以 | 开头）：剥离首个 | 作为前缀，body 继续处理单元格内容
  if (line.trimStart().startsWith('|')) {
    const leadingSpaces = line.match(/^(\s*)/)?.[1] ?? '';
    const rest = line.slice(leadingSpaces.length + 1); // 去掉首个 |
    return { prefix: leadingSpaces + '|', body: rest };
  }

  return { prefix: '', body: line };
}

// ──────────────────────────────────────────────────────────────────────────────
// 行内分段：在 body 内找到不可翻译的区间，返回片段数组
// ──────────────────────────────────────────────────────────────────────────────
interface Segment { text: string; translate: boolean; inTable?: boolean }

function splitBodyToSegments(body: string, inTable: boolean): Segment[] {
  const ranges: [number, number][] = [];

  const scan = (re: RegExp) => {
    const r = new RegExp(re.source, re.flags);
    let m: RegExpExecArray | null;
    while ((m = r.exec(body)) !== null) {
      ranges.push([m.index, m.index + m[0].length]);
    }
  };

  // 行内代码 `...`
  scan(/`[^`]+`/g);
  // HTML 开标签（含属性，避免 height→高度 等被翻译）
  scan(/<[a-zA-Z][^>]*\/?>/g);
  // HTML 闭合标签
  scan(/<\/[a-zA-Z][^>]*>/g);
  // HTML 注释
  scan(/<!--[\s\S]*?-->/g);
  // Markdown 链接/图片/引用链接：用括号平衡扫描，兼容嵌套 [] 和 URL 中的 ()
  // 翻译 API 在看到链接文字时会引入 [ ]、（）等结构字符，破坏渲染；整体 raw 最安全
  ranges.push(...collectMarkdownLinkRanges(body));
  // 自动链接 <https://...> / <user@example.com>
  scan(/<(https?:\/\/[^>\s]+|[^>\s]+@[^>\s]+)>/g);
  // 裸 URL（http/https）
  scan(/https?:\/\/[^\s)>\]"'`|]+/g);

  // 表格行：| 是列分隔符，需原样保留，不送翻译
  if (inTable) scan(/\s*\|\s*/g);

  const merged = mergeRanges(ranges);
  const segments: Segment[] = [];
  let pos = 0;
  for (const [s, e] of merged) {
    if (pos < s) segments.push({ text: body.slice(pos, s), translate: true, inTable });
    segments.push({ text: body.slice(s, e), translate: false, inTable });
    pos = e;
  }
  if (pos < body.length) segments.push({ text: body.slice(pos), translate: true, inTable });
  if (!segments.length)  segments.push({ text: body, translate: true, inTable });

  return segments;
}

// ──────────────────────────────────────────────────────────────────────────────
// 翻译结果后处理：清理翻译 API 异常插入的换行和管道符
// ──────────────────────────────────────────────────────────────────────────────
function sanitizeTranslated(text: string, inTable: boolean): string {
  // 1. 清除翻译 API 异常插入的换行（一个片段对应一个翻译结果，不应有换行）
  let t = text.replace(/\r?\n/g, ' ').replace(/\r/g, ' ');

  // 2. 表格单元格内：把半角 | 转为全角 ｜，防止破坏表格列结构
  if (inTable) t = t.replace(/\|/g, '｜');

  // 3. 翻译 API 有时把方括号全角化（[ → 【，] → 】），防止这些字符
  //    出现在本应是纯文字的翻译片段里（链接/图片/代码已整体 raw，不会出现此问题）
  t = t.replace(/【/g, '[').replace(/】/g, ']');

  // 4. 翻译 API 在处理形如 `(key)` 的文本时会把括号全角化 `（key）`，
  //    纯文字片段中出现的括号应当保持原样（Markdown 中括号无语法含义，
  //    但全角括号会让 README 的英文文档排版变得奇怪）
  //    注意：URL 已经被 raw 保护，不会被翻译，此处替换不会影响链接结构
  t = t.replace(/（/g, '(').replace(/）/g, ')');

  return t;
}

// ──────────────────────────────────────────────────────────────────────────────
// 块级分离：把 Markdown 拆成「保留块」和「翻译行」
// ──────────────────────────────────────────────────────────────────────────────
interface MarkdownBlock {
  lines: string[];
  raw: boolean;         // true → 整行原样输出
  inTable?: boolean;    // true → 该行是表格数据行（非分隔行）
}

const HTML_VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

function countMatches(text: string, re: RegExp): number {
  const matches = text.match(re);
  return matches ? matches.length : 0;
}

function collectHtmlBlock(rawLines: string[], start: number): { lines: string[]; nextIndex: number } {
  const first = rawLines[start];
  const firstTrimmed = first.trim();

  if (/^<!--/.test(firstTrimmed)) {
    const chunk: string[] = [first];
    let i = start + 1;
    while (i < rawLines.length) {
      chunk.push(rawLines[i]);
      if (rawLines[i].includes('-->')) {
        i++;
        break;
      }
      i++;
    }
    return { lines: chunk, nextIndex: i };
  }

  const tagMatch = first.match(/^\s*<([a-zA-Z][\w:-]*)\b/);
  if (!tagMatch) return { lines: [first], nextIndex: start + 1 };

  const tagName = tagMatch[1].toLowerCase();
  if (
    HTML_VOID_TAGS.has(tagName)
    || /\/>\s*$/.test(firstTrimmed)
    || new RegExp(`</${tagName}>`, 'i').test(first)
  ) {
    return { lines: [first], nextIndex: start + 1 };
  }

  const openTagRe = new RegExp(`<${tagName}(?=[\\s>/])`, 'gi');
  const closeTagRe = new RegExp(`</${tagName}>`, 'gi');
  const chunk: string[] = [first];
  let depth = countMatches(first, openTagRe) - countMatches(first, closeTagRe);
  let i = start + 1;

  while (i < rawLines.length) {
    const line = rawLines[i];
    const trimmed = line.trim();
    chunk.push(line);
    depth += countMatches(line, openTagRe);
    depth -= countMatches(line, closeTagRe);
    i++;
    if (depth <= 0) break;
    if (!trimmed) break;
  }

  return { lines: chunk, nextIndex: i };
}

function splitToBlocks(md: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const rawLines = md.split('\n');
  let i = 0;

  while (i < rawLines.length) {
    const line = rawLines[i];
    const trimmed = line.trim();

    // ── 围栏代码块 ``` 或 ~~~（完整保留，含结束围栏）
    const fenceMatch = line.match(/^(`{3,}|~{3,})/);
    if (fenceMatch) {
      const fence = fenceMatch[1];
      const chunk: string[] = [line];
      i++;
      while (i < rawLines.length) {
        chunk.push(rawLines[i]);
        if (rawLines[i].trimEnd() === fence || rawLines[i].startsWith(fence)) { i++; break; }
        i++;
      }
      blocks.push({ lines: chunk, raw: true });
      continue;
    }

    // ── 缩进代码行（4 空格 / Tab）
    if (/^(?: {4}|\t)/.test(line)) {
      blocks.push({ lines: [line], raw: true });
      i++;
      continue;
    }

    // ── HTML 块（单行/多行标签、注释）完整保留，避免翻译破坏标签结构
    if (/^\s*<[a-zA-Z!]/.test(line)) {
      const htmlBlock = collectHtmlBlock(rawLines, i);
      blocks.push({ lines: htmlBlock.lines, raw: true });
      i = htmlBlock.nextIndex;
      continue;
    }

    // ── 表格分隔行（|---|---| 或 :---: 等）— 原样保留
    if (/^\s*\|?[\s:]*-{2,}[\s:]*[|\s:|-]*$/.test(line) && trimmed.length > 0) {
      blocks.push({ lines: [line], raw: true });
      i++;
      continue;
    }

    // ── 水平分隔线 *** / ___ / === / --- 独立行（三个以上相同符号，可含空格）
    // 注：--- 已被上面表格分隔行正则覆盖；此处补充 *** / ___ / ===
    if (/^\s*(\*{3,}|_{3,}|={3,})[\s*_=]*$/.test(trimmed) && trimmed.length > 0) {
      blocks.push({ lines: [line], raw: true });
      i++;
      continue;
    }

    // ── Setext 标题下划线（下一行是 === 或 ---，当前行是标题文字）
    // 下划线行本身标为 raw；上一行（文字行）由后续普通流程处理翻译
    if (/^=+\s*$/.test(trimmed) && trimmed.length > 0) {
      blocks.push({ lines: [line], raw: true });
      i++;
      continue;
    }

    // ── GitHub Alert 行（> [!NOTE] / > [!WARNING] 等）— 原样保留
    if (/^\s*>\s*\[!(NOTE|TIP|WARNING|CAUTION|IMPORTANT)\]/i.test(line)) {
      blocks.push({ lines: [line], raw: true });
      i++;
      continue;
    }

    // ── Markdown 参考链接定义 [id]: url
    if (/^\s*\[[^\]]+\]:\s*\S/.test(line)) {
      blocks.push({ lines: [line], raw: true });
      i++;
      continue;
    }

    // ── Front-matter（文件开头 --- 块）
    if (i === 0 && trimmed === '---') {
      const chunk: string[] = [line];
      i++;
      while (i < rawLines.length && rawLines[i].trim() !== '---') chunk.push(rawLines[i++]);
      if (i < rawLines.length) chunk.push(rawLines[i++]);
      blocks.push({ lines: chunk, raw: true });
      continue;
    }

    // ── 空行
    if (!trimmed) {
      blocks.push({ lines: [line], raw: true });
      i++;
      continue;
    }

    // ── 普通文字行（标题/段落/列表/引用/表格数据行 等）→ 翻译
    const isTableRow = trimmed.startsWith('|') || trimmed.endsWith('|');
    blocks.push({ lines: [line], raw: false, inTable: isTableRow });
    i++;
  }

  return blocks;
}

// ──────────────────────────────────────────────────────────────────────────────
// 结构校验：比较原始 Markdown 和翻译后 Markdown 的关键结构数量
// 差异超过阈值时，判定翻译破坏了结构，回退到原文
// ──────────────────────────────────────────────────────────────────────────────
interface StructCounts {
  headings: number;     // # 标题行数
  tableSeps: number;    // |---| 分隔行数
  codeFences: number;   // ``` 围栏标记数
  listItems: number;    // 列表项行数
}

function countStructures(md: string): StructCounts {
  const lines = md.split('\n');
  let headings = 0, tableSeps = 0, codeFences = 0, listItems = 0;
  let inFence = false;
  for (const line of lines) {
    if (/^(`{3,}|~{3,})/.test(line)) { codeFences++; inFence = !inFence; continue; }
    if (inFence) continue;
    if (/^#{1,6} /.test(line))                                   headings++;
    if (/^\s*\|?[\s:]*-{2,}[\s:]*[|\s:|-]*$/.test(line) && line.trim()) tableSeps++;
    if (/^\s*[-*+]\s|^\s*\d+\.\s/.test(line))                   listItems++;
  }
  return { headings, tableSeps, codeFences, listItems };
}

/** 若任意关键结构的数量差异超过 20%（且原文有该结构），判定为结构损坏 */
function isStructurallyCorrupted(orig: StructCounts, translated: StructCounts): boolean {
  const check = (o: number, t: number) => o > 0 && Math.abs(o - t) / o > 0.2;
  return check(orig.headings,   translated.headings)
      || check(orig.tableSeps,  translated.tableSeps)
      || check(orig.codeFences, translated.codeFences)
      || check(orig.listItems,  translated.listItems);
}

// ──────────────────────────────────────────────────────────────────────────────
// 主入口：translateMarkdown
// ──────────────────────────────────────────────────────────────────────────────

/**
 * 翻译 Markdown 文本，严格保护语法结构，只翻译纯文字片段。
 *
 * 保护对象：标题 #、列表 -/1.、任务列表 [ ]/[x]、引用 >、表格 |、
 *           代码块/行内代码、HTML 标签和属性、图片 Markdown、链接 URL、
 *           参考链接定义、GitHub Alert（> [!NOTE] 等）。
 *
 * 翻译后处理：清理异常换行、表格内半角 | 转全角 ｜。
 * 结构校验：翻译后结构损坏时自动回退原文。
 *
 * @param md  原始 Markdown
 * @param to  目标语言
 * @returns   结构完整的翻译后 Markdown，失败或结构损坏时降级返回原文
 */
export async function translateMarkdown(md: string, to: 'zh' | 'en'): Promise<string> {
  if (!md?.trim()) return md;
  const cacheKey = `markdown:${to}|${md}`;
  const cached = markdownMemCache.get(cacheKey);
  if (cached !== undefined) return cached;
  const inflight = markdownInFlight.get(cacheKey);
  if (inflight) return inflight;

  const job = (async () => {
    // 翻译前记录结构特征，用于后置校验
    const origCounts = countStructures(md);

    try {
      const blocks = splitToBlocks(md);

      // ── 第一步：对每个翻译行，剥离前缀后进行行内分段
      type SegMapEntry = {
        prefix: string;
        segments: Segment[];
      };
      // segEntries[blockIdx] = SegMapEntry[] | null（raw 块为 null）
      const segEntries: (SegMapEntry[] | null)[] = blocks.map(block => {
        if (block.raw) return null;
        return block.lines.map(line => {
          const { prefix, body } = stripLinePrefix(line);
          const segments = splitBodyToSegments(body, block.inTable ?? false);
          return { prefix, segments };
        });
      });

      // ── 第二步：收集所有需要翻译的纯文字片段
      const toTranslateTexts: string[] = [];
      const textIndex: Array<{ bi: number; li: number; si: number }> = [];

      segEntries.forEach((entries, bi) => {
        if (!entries) return;
        entries.forEach((entry, li) => {
          entry.segments.forEach((seg, si) => {
            if (seg.translate && seg.text.trim()) {
              textIndex.push({ bi, li, si });
              toTranslateTexts.push(seg.text);
            }
          });
        });
      });

      if (!toTranslateTexts.length) return md;

      // ── 第三步：批量翻译
      const translated = await translateBatch(toTranslateTexts, to);

      // ── 第四步：填回翻译结果，并执行后处理
      translated.forEach((dst, idx) => {
        const { bi, li, si } = textIndex[idx];
        const entries = segEntries[bi];
        if (!entries) return;
        const seg = entries[li].segments[si];
        const cleaned = sanitizeTranslated(dst, seg.inTable ?? false);
        entries[li].segments[si] = { ...seg, text: cleaned };
      });

      // ── 第五步：重组
      const resultLines: string[] = [];
      blocks.forEach((block, bi) => {
        const entries = segEntries[bi];
        if (!entries) {
          resultLines.push(...block.lines);
        } else {
          entries.forEach(({ prefix, segments }) => {
            resultLines.push(prefix + segments.map(s => s.text).join(''));
          });
        }
      });

      const result = resultLines.join('\n');

      // ── 第六步：结构校验，损坏时回退原文
      const translatedCounts = countStructures(result);
      const finalResult = isStructurallyCorrupted(origCounts, translatedCounts) ? md : result;
      markdownMemCache.set(cacheKey, finalResult);
      return finalResult;
    } catch {
      markdownMemCache.set(cacheKey, md);
      return md;
    }
  })();

  markdownInFlight.set(cacheKey, job);
  try {
    return await job;
  } finally {
    markdownInFlight.delete(cacheKey);
  }
}

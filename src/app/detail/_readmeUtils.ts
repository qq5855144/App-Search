// ─── README 渲染公共工具：CSS、HTML 生成器 ──────────────────────────────────────
// marked.js + highlight.js 完全内联，零 CDN 依赖，Android/iOS/Web 三端一致渲染
import { MARKED_INLINE, HLJS_INLINE, HLJS_GITHUB_CSS } from './_readmeBundles';

export const README_CSS = `
  * { box-sizing: border-box; }
  html, body { width: 100%; max-width: 100%; overflow-x: hidden; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif;
    font-size: 14px; line-height: 1.6; color: #1F2328;
    padding: 4px 2px 12px; margin: 0;
    word-wrap: break-word; overflow-wrap: break-word;
  }
  h1 { font-size: 1.85em; font-weight: 600; border-bottom: 1px solid #d8dee4; padding-bottom: .3em; margin: 20px 0 14px; }
  h2 { font-size: 1.4em;  font-weight: 600; border-bottom: 1px solid #d8dee4; padding-bottom: .3em; margin: 20px 0 12px; }
  h3 { font-size: 1.15em; font-weight: 600; margin: 16px 0 10px; }
  h4 { font-size: 1em;    font-weight: 600; margin: 14px 0 8px; }
  h5 { font-size: .9em;   font-weight: 600; margin: 12px 0 6px; }
  h6 { font-size: .85em;  font-weight: 600; color: #656d76; margin: 10px 0 4px; }
  p  { margin: 0 0 12px; }
  a  { color: #0969da; text-decoration: none; }
  a:hover { text-decoration: underline; }
  /* 图片：max-width 限制宽度，不强制 width:auto 避免压缩小图 */
  img {
    max-width: 100%; height: auto; display: block; margin: 8px 0;
    /* broken image 时显示 alt 文字，方便排查 */
    min-height: 1px;
  }
  /* 徽章/行内小图、链接内图片保持 inline */
  p > img, li img, a > img, td img, th img {
    display: inline-block; margin: 2px 3px; vertical-align: middle;
  }
  /* 居中单独一行的图片（常见于截图展示） */
  p:has(> img:only-child) { text-align: center; }
  /* 确保 markdown 根容器始终撑满视口宽度 */
  #md { width: 100%; }
  code {
    font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace;
    font-size: 85%; background: rgba(175,184,193,0.2);
    border-radius: 3px; padding: .2em .4em;
  }
  pre {
    background: #f6f8fa; border-radius: 6px; padding: 14px 16px;
    overflow-x: scroll; overflow-y: hidden; margin: 0 0 14px; max-width: 100%;
  }
  pre code { background: none; padding: 0; font-size: 85%; border-radius: 0; white-space: pre; }
  table { border-collapse: collapse; width: 100%; max-width: 100%; margin: 8px 0 14px; display: block; overflow-x: scroll; }
  th, td { border: 1px solid #d8dee4; padding: 6px 12px; text-align: left; }
  th { background: #f6f8fa; font-weight: 600; }
  tr:nth-child(even) td { background: #f8f9fa; }
  blockquote { margin: 0 0 14px; padding: 2px 14px; color: #656d76; }
  ul, ol { padding-left: 2em; margin: 0 0 12px; }
  li { margin: 3px 0; }
  li + li { margin-top: 4px; }
  li p { margin: 4px 0; }
  hr { border: none; border-top: 1px solid #d8dee4; margin: 20px 0; }
  .task-list-item { list-style: none; margin-left: -1.5em; }
  .task-list-item input[type=checkbox] { margin-right: .4em; vertical-align: middle; }
  .markdown-alert { padding: 8px 16px; margin: 8px 0 14px; border-left: 4px solid; border-radius: 4px; }
  .markdown-alert-note      { background: #ddf4ff; border-color: #0969da; color: #0550ae; }
  .markdown-alert-tip       { background: #dafbe1; border-color: #1a7f37; color: #116329; }
  .markdown-alert-warning   { background: #fff8c5; border-color: #9a6700; color: #7d4e00; }
  .markdown-alert-caution   { background: #ffebe9; border-color: #cf222e; color: #a40e26; }
  .markdown-alert-important { background: #fbefff; border-color: #8250df; color: #6639ba; }
  .markdown-alert-title { font-weight: 700; margin-bottom: 6px; }
  .hljs { background: transparent !important; }
`;

const HEIGHT_SCRIPT = `
  function reportHeight() {
    var h = document.documentElement.scrollHeight || document.body.scrollHeight;
    var msg = JSON.stringify({ type: 'height', height: h });
    if (window.ReactNativeWebView) { window.ReactNativeWebView.postMessage(msg); }
    else if (window.parent && window.parent !== window) { window.parent.postMessage(msg, '*'); }
  }
  // 阶段一：DOM 渲染完成后立即上报（文字/表格布局已确定）
  setTimeout(reportHeight, 80);
  // 阶段二：等待图片加载 —— 为每张图片绑定 onload/onerror，确保图片撑开后重报
  function bindImgListeners() {
    var imgs = document.querySelectorAll('#md img');
    var pending = imgs.length;
    if (pending === 0) return;
    function onImgDone() { reportHeight(); }
    for (var i = 0; i < imgs.length; i++) {
      if (imgs[i].complete) {
        pending--;
      } else {
        imgs[i].addEventListener('load',  onImgDone);
        imgs[i].addEventListener('error', onImgDone);
      }
    }
    if (pending < imgs.length) reportHeight(); // 已有部分图片完成
  }
  // 阶段三：多级兜底延时，覆盖慢速网络 / WebView load 事件不可靠的情况
  setTimeout(function() { bindImgListeners(); reportHeight(); }, 300);
  setTimeout(reportHeight, 800);
  setTimeout(reportHeight, 2000);
  window.addEventListener('load', function() { setTimeout(reportHeight, 200); });
`;

/**
 * 构建用于 WebView 的完整 HTML 文档
 * @param markdown  原始 Markdown 文本
 * @param baseUrl   相对路径前缀（raw.githubusercontent.com）
 * @param viewportWidth  WebView 实际像素宽度，用于精确 viewport 避免缩放
 */
export function buildReadmeHtml(markdown: string, baseUrl: string, viewportWidth: number): string {
  // 用 JSON.stringify 序列化 Markdown：
  //   - 不依赖废弃的 btoa/unescape/escape（Hermes 实现存在差异）
  //   - JSON.stringify 在所有 JS 环境中均可靠
  //   - 替换 </ 为 <\/ 防止 HTML 解析器提前截断 <script> 块
  const safeMarkdown = JSON.stringify(markdown).replace(/<\//g, '<\\/');

  const safeBase = JSON.stringify(baseUrl); // 带外层双引号的 JSON 字符串

  const js = `
    // 全局错误捕获：把 WebView 内 JS 错误上报给 React Native（便于诊断）
    window.onerror = function(msg, src, line, col, err) {
      var info = JSON.stringify({ type: 'rnerror', message: String(msg), line: line });
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(info);
      return true;
    };

    try {

    // 1. 原始 Markdown 内容（JSON 字符串字面量，已安全转义）
    var raw = ${safeMarkdown};

    // 2. 解析相对 URL → 绝对 URL（Markdown 语法部分，HTML img 标签在 DOM 阶段修正）
    var _base = ${safeBase};
    // 2a. Markdown 行内链接 [text](relative/path)
    raw = raw.replace(/(\\]\\()((?!https?:\\/\\/|mailto:|#)[^)]+)(\\))/g, function(m, a, p, c) {
      return a + _base + p + c;
    });
    // 2b. Markdown 图片 ![alt](relative/path)
    raw = raw.replace(/(!\\[[^\\]]*\\]\\()((?!https?:\\/\\/)[^)]+)(\\))/g, function(m, a, p, c) {
      return a + _base + p + c;
    });

    // 3. 配置 marked（GFM + 代码高亮）
    marked.use({ gfm: true, breaks: false, html: true });
    var renderer = new marked.Renderer();
    renderer.code = function(code, lang) {
      var language = (lang || '').split(/[\\s,]/)[0];
      var highlighted = '';
      if (language && hljs.getLanguage(language)) {
        try { highlighted = hljs.highlight(code, { language: language, ignoreIllegals: true }).value; }
        catch(e) { highlighted = hljs.highlightAuto(code).value; }
      } else {
        highlighted = hljs.highlightAuto(code).value;
      }
      return '<pre><code class="hljs language-' + (language || 'plaintext') + '">' + highlighted + '</code></pre>';
    };

    // 4. GitHub Admonitions: > [!NOTE] → 彩色提示框
    raw = raw.replace(/^>\\s*\\[!(NOTE|TIP|WARNING|CAUTION|IMPORTANT)\\]\\s*$/gm, function(_, type) {
      var t = type.toLowerCase();
      var labels = { note:'📘 Note', tip:'✅ Tip', warning:'⚠️ Warning', caution:'🚨 Caution', important:'❗ Important' };
      return '> <div class="markdown-alert-title markdown-alert-' + t + '">' + (labels[t]||type) + '</div>';
    });
    // 包裹 blockquote 中含有 alert-title 的为 alert div
    var html = marked.parse(raw, { renderer: renderer });
    html = html.replace(/<blockquote>\\s*<p><div class="markdown-alert-title (markdown-alert-[^"]+)">([^<]+)<\\/div>/g,
      '<div class="markdown-alert $1"><div class="markdown-alert-title">$2</div><p>');
    html = html.replace(/<\\/p>\\s*<\\/blockquote>/g, '</p></div>');

    // 5. 任务列表：- [ ] / - [x]
    html = html.replace(/<li><p>\\[ \\]/g, '<li class="task-list-item"><p><input type="checkbox" disabled> ');
    html = html.replace(/<li><p>\\[x\\]/gi, '<li class="task-list-item"><p><input type="checkbox" disabled checked> ');
    html = html.replace(/<li>\\[ \\]/g, '<li class="task-list-item"><input type="checkbox" disabled> ');
    html = html.replace(/<li>\\[x\\]/gi, '<li class="task-list-item"><input type="checkbox" disabled checked> ');

    // 6. shields.io 徽章强制 PNG 格式（React Native 无法渲染 SVG img）
    html = html.replace(/(<img[^>]+src=")([^"]*shields\\.io[^"]*|[^"]*badge\\.svg[^"]*|[^"]*badgen\\.net[^"]*)(")/gi, function(m, a, src, c) {
      return a + (src.includes('?') ? src + '&format=png' : src + '?format=png') + c;
    });

    document.getElementById('md').innerHTML = html;

    // 7. 仅移除超出容器宽度的固定像素 width/height 属性（保留百分比、小尺寸徽章等）
    var vpW = ${viewportWidth};
    document.querySelectorAll('#md img').forEach(function(img) {
      // 7a. 兜底：确保 DOM 中所有 img src 为绝对 URL
      var src = img.getAttribute('src') || '';
      if (src && !/^https?:\\/\\/|^data:|^\\/\\//.test(src)) {
        img.setAttribute('src', _base + src.replace(/^\\//, ''));
      }
      // 7b. 移除超宽的 width/height HTML 属性
      var wAttr = img.getAttribute('width') || '';
      var wNum = parseFloat(wAttr);
      if (wAttr.indexOf('%') === -1 && wNum > vpW) {
        img.removeAttribute('width');
        img.removeAttribute('height');
      }
      // 7c. 移除 inline style 中超宽的 width（如 style="width:480px"）
      if (img.style.width && img.style.width.indexOf('%') === -1 &&
          parseFloat(img.style.width) > vpW) {
        img.style.width = '';
        img.style.height = '';
      }
    });

    } catch(e) {
      // 渲染异常时显示错误信息，避免空白页
      document.getElementById('md').innerHTML =
        '<p style="color:#cf222e;font-family:monospace;font-size:13px;padding:8px;border:1px solid #cf222e;border-radius:4px">'
        + 'README 渲染错误：' + e.message + '</p>';
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'rnerror', message: e.message }));
      }
    }
  `;

  return (
    '<!DOCTYPE html>\n' +
    '<html lang="zh-CN">\n' +
    '<head>\n' +
    '<meta charset="UTF-8">\n' +
    `<meta name="viewport" content="width=${viewportWidth},initial-scale=1.0,maximum-scale=1.0,user-scalable=no">\n` +
    '<style>\n' + HLJS_GITHUB_CSS + '\n' + README_CSS + '\n</style>\n' +
    '<script>\n' + MARKED_INLINE + '\n</script>\n' +
    '<script>\n' + HLJS_INLINE + '\n</script>\n' +
    '</head>\n' +
    '<body>\n' +
    '<div id="md"></div>\n' +
    '<script>\n' + HEIGHT_SCRIPT + '\n' + js + '\n</script>\n' +
    '</body>\n' +
    '</html>'
  );
}

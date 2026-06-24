// ─── README 渲染公共工具：CSS、HTML 生成器 ──────────────────────────────────────
// 使用 marked.js (GFM) + highlight.js（CDN）在 WebView 中渲染，效果与 GitHub 一致

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
  img { max-width: 100%; height: auto; display: block; margin: 4px 0; }
  /* 徽章/行内小图、链接内图片保持 inline */
  p > img, li img, a > img { display: inline-block; margin: 1px 2px; }
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

// 高度上报脚本：分两阶段上报，确保图片等异步资源加载后高度也被捕获
// 与 React Native onMessage 配合；source memoize 后不会触发重载循环
const HEIGHT_SCRIPT = `
  function reportHeight() {
    var h = document.documentElement.scrollHeight || document.body.scrollHeight;
    var msg = JSON.stringify({ type: 'height', height: h });
    if (window.ReactNativeWebView) { window.ReactNativeWebView.postMessage(msg); }
    else if (window.parent && window.parent !== window) { window.parent.postMessage(msg, '*'); }
  }
  // 阶段一：DOM 渲染完成后上报（文字、表格等布局已确定）
  setTimeout(reportHeight, 80);
  // 阶段二：所有资源（图片等）加载完成后再上报，捕获图片撑开的高度
  window.addEventListener('load', function() { setTimeout(reportHeight, 300); });
`;

/**
 * 构建用于 WebView 的完整 HTML 文档
 * @param markdown  原始 Markdown 文本
 * @param baseUrl   相对路径前缀（raw.githubusercontent.com）
 * @param viewportWidth  WebView 实际像素宽度，用于精确 viewport 避免缩放
 */
export function buildReadmeHtml(markdown: string, baseUrl: string, viewportWidth: number): string {
  // base64 编码：彻底避免 markdown 内容中反引号、$、\ 等导致的 JS 注入/转义问题
  // React Native 环境：使用 global btoa（React Native 已内置）
  const b64 = btoa(unescape(encodeURIComponent(markdown)));

  const safeBase = baseUrl.replace(/'/g, "\\'");

  const js = `
    // 1. 解码原始 Markdown
    var raw = decodeURIComponent(escape(atob('${b64}')));

    // 2. 解析相对 URL → 绝对 URL
    raw = raw.replace(/(\\]\\()((?!https?:\\/\\/|mailto:|#)[^)]+)(\\))/g, function(m, a, p, c) {
      return a + '${safeBase}' + p + c;
    });
    raw = raw.replace(/(!\\[[^\\]]*\\]\\()((?!https?:\\/\\/)[^)]+)(\\))/g, function(m, a, p, c) {
      return a + '${safeBase}' + p + c;
    });

    // 3. 配置 marked（GFM + 代码高亮）
    marked.use({
      gfm: true,
      breaks: false,
      extensions: [],
    });
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
    // CSS max-width:100% 无法阻止浏览器在布局阶段用 HTML attribute 撑开文档最小宽，
    // 因此对 width > viewportWidth 的图片直接 removeAttribute
    var vpW = ${viewportWidth};
    document.querySelectorAll('#md img').forEach(function(img) {
      var wAttr = img.getAttribute('width') || '';
      var wNum = parseFloat(wAttr);
      if (wAttr.indexOf('%') === -1 && wNum > vpW) {
        img.removeAttribute('width');
        img.removeAttribute('height');
      }
      // 移除 inline style 中超宽的 width（如 style="width:480px"）
      if (img.style.width && img.style.width.indexOf('%') === -1 &&
          parseFloat(img.style.width) > vpW) {
        img.style.width = '';
        img.style.height = '';
      }
    });
  `;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=${viewportWidth},initial-scale=1.0,maximum-scale=1.0,user-scalable=no">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/marked/12.0.0/marked.min.js"><\/script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"><\/script>
<style>${README_CSS}<\/style>
</head>
<body>
<div id="md"></div>
<script>${js}<\/script>
</body>
</html>`;
}
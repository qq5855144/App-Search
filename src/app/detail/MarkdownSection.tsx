// ─── README 渲染（Web）— iframe + marked + highlight.js ──────────────────────
// 使用 iframe srcdoc：iframe 拥有独立文档上下文，<script> 可正常执行。
// dangerouslySetInnerHTML 会剥离 <script> 标签，因此不能用于 Web 端。
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { buildReadmeHtml } from './_readmeUtils';

interface Props {
  content: string;
  owner: string;
  repo: string;
}

export default function MarkdownSection({ content, owner, repo }: Props) {
  const [iframeHeight, setIframeHeight] = useState(200);

  if (!content) return null;

  const cleaned = content.replace(/^---[\s\S]*?---\r?\n?/, '').trim();
  if (!cleaned) return null;

  const baseUrl = `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/`;
  const escapedMd = cleaned
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$')
    .replace(/<\/(script|style)>/gi, '<\\/$1>');

  const html = buildReadmeHtml(escapedMd, baseUrl);

  const handleMessage = useCallback((e: MessageEvent) => {
    try {
      const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
      if (data.type === 'height' && data.height > 0) {
        setIframeHeight(data.height + 20);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, marginTop: 4 }}>
      <Text style={{ fontSize: 15, fontWeight: '700', color: '#1A1A1A', marginBottom: 10 }}>README</Text>
      {/* @ts-ignore — iframe 是 HTML 原生元素 */}
      <iframe
        srcDoc={html}
        style={{
          width: '100%',
          height: iframeHeight,
          border: 'none',
          borderRadius: 8,
        }}
        title="README"
        sandbox="allow-scripts allow-same-origin"
      />
    </View>
  );
}
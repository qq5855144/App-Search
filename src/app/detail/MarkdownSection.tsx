// ─── README 渲染 — WebView 方案（marked.js GFM + highlight.js 代码高亮）────────
// 效果与 GitHub 完全一致：标题、代码块语法高亮、表格、任务列表、Admonitions、徽章
import React, { useState, useCallback } from 'react';
import { View, Text, Platform, ActivityIndicator } from 'react-native';
import WebView, { type WebViewMessageEvent } from 'react-native-webview';
import { buildReadmeHtml } from './_readmeUtils';

interface Props {
  content: string;
  owner: string;
  repo: string;
}

const MIN_HEIGHT = 120;

export default function MarkdownSection({ content, owner, repo }: Props) {
  const [height, setHeight] = useState(MIN_HEIGHT);
  const [loaded, setLoaded] = useState(false);

  const baseUrl = `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/`;

  const onMessage = useCallback((e: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(e.nativeEvent.data);
      if (data.type === 'height' && typeof data.height === 'number' && data.height > MIN_HEIGHT) {
        setHeight(data.height + 24); // padding buffer
      }
    } catch { /* 忽略非 JSON 消息 */ }
  }, []);

  if (!content) return null;

  const html = buildReadmeHtml(content, baseUrl);

  // ── Web 平台：iframe ──────────────────────────────────────────────────────
  if (Platform.OS === 'web') {
    return (
      <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, marginTop: 4 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: '#1A1A1A', marginBottom: 10 }}>README</Text>
        {/* @ts-ignore web only */}
        <iframe
          srcDoc={html}
          style={{ width: '100%', minHeight: 500, border: 'none', display: 'block' }}
          sandbox="allow-scripts allow-same-origin"
          onLoad={(e: any) => {
            // 监听 postMessage 上报的高度
            const handler = (ev: MessageEvent) => {
              try {
                const d = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data;
                if (d?.type === 'height' && d.height > 0) {
                  e.target.style.height = (d.height + 24) + 'px';
                  window.removeEventListener('message', handler);
                }
              } catch { /* ignore */ }
            };
            window.addEventListener('message', handler);
          }}
        />
      </View>
    );
  }

  // ── Native 平台：WebView ──────────────────────────────────────────────────
  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, marginTop: 4 }}>
      <Text style={{ fontSize: 15, fontWeight: '700', color: '#1A1A1A', marginBottom: 10 }}>README</Text>
      {!loaded && (
        <ActivityIndicator size="small" color="#0969da" style={{ marginVertical: 20 }} />
      )}
      <WebView
        source={{ html, baseUrl: `https://github.com/${owner}/${repo}` }}
        style={{ height, opacity: loaded ? 1 : 0 }}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        originWhitelist={['*']}
        onMessage={onMessage}
        onLoad={() => setLoaded(true)}
        // 允许加载 CDN 资源（marked.js / highlight.js / github.css）
        mixedContentMode="always"
        javaScriptEnabled
        domStorageEnabled={false}
        cacheEnabled
      />
    </View>
  );
}
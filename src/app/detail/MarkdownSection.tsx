// ─── README 渲染 — WebView 方案（marked.js GFM + highlight.js 代码高亮）────────
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { View, Text, Platform, ActivityIndicator, useWindowDimensions } from 'react-native';
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
  const { width: windowWidth } = useWindowDimensions();
  // 屏幕 padding 12*2 + 卡片内 padding 16*2 = 56
  const webViewWidth = windowWidth - 56;

  const baseUrl = `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/`;

  // html 与 source 都 memoize：任何一个引用变化都会触发 WebView 完整重载
  // → 重载会重新执行 HEIGHT_SCRIPT → postMessage → setHeight → re-render → 无限循环
  const html = useMemo(() => {
    try {
      return buildReadmeHtml(content, baseUrl, webViewWidth);
    } catch (e) {
      console.error('[MarkdownSection] buildReadmeHtml 异常:', e);
      return `<html><body style="font-family:sans-serif;padding:12px;color:#cf222e"><p>README 构建错误：${String(e)}</p></body></html>`;
    }
  }, [content, baseUrl, webViewWidth]);
  const source = useMemo(
    () => ({ html, baseUrl: `https://github.com/${owner}/${repo}` }),
    [html, owner, repo]
  );

  useEffect(() => {
    setLoaded(false);
  }, [html]);

  // postMessage 高度上报：setHeight 只增不减，且 source memoize 后不触发重载
  const onMessage = useCallback((e: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(e.nativeEvent.data);
      if (data.type === 'height' && typeof data.height === 'number') {
        setHeight(prev => Math.max(prev, data.height + 24));
      } else if (data.type === 'rnerror') {
        // WebView 内部 JS 错误诊断（window.onerror / catch 上报）
        console.error('[MarkdownSection] WebView JS 错误:', data.message, 'line:', data.line);
      }
    } catch { /* 忽略非 JSON 消息 */ }
  }, []);

  if (!content) return null;

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
        />
      </View>
    );
  }

  // ── Native 平台：WebView ──────────────────────────────────────────────────
  // opacity 放在 wrapper View 而非 WebView style，避免 setLoaded 触发 WebView 样式更新/重排
  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, marginTop: 4, width: '100%' }}>
      <Text style={{ fontSize: 15, fontWeight: '700', color: '#1A1A1A', marginBottom: 10 }}>README</Text>
      {!loaded && (
        <ActivityIndicator size="small" color="#0969da" style={{ marginVertical: 20 }} />
      )}
      <View style={{ opacity: loaded ? 1 : 0 }}>
        <WebView
          source={source}
          style={{ height, width: webViewWidth }}
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          originWhitelist={['*']}
          onMessage={onMessage}
          onLoadEnd={() => setLoaded(true)}
          onError={(e) => console.error('[MarkdownSection] WebView onError:', e.nativeEvent)}
          mixedContentMode="always"
          javaScriptEnabled
          domStorageEnabled={false}
          cacheEnabled
          scalesPageToFit={false}
        />
      </View>
    </View>
  );
}

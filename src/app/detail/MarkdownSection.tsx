// ─── README 渲染 — WebView + 内联 marked/hljs（零 CDN，GitHub 风格还原）────────
import React, { useState, useCallback, useMemo } from 'react';
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

  const html = useMemo(
    () => buildReadmeHtml(content, baseUrl, webViewWidth),
    [content, baseUrl, webViewWidth]
  );
  const source = useMemo(
    () => ({ html, baseUrl: `https://github.com/${owner}/${repo}` }),
    [html, owner, repo]
  );

  // 只增不减：避免图片加载前的小值覆盖最终正确高度
  const onMessage = useCallback((e: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(e.nativeEvent.data);
      if (data.type === 'height' && typeof data.height === 'number') {
        const reported = Math.max(MIN_HEIGHT, Math.ceil(data.height) + 24);
        setHeight((prev) => (reported > prev ? reported : prev));
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
          sandbox="allow-scripts"
        />
      </View>
    );
  }

  // ── Native 平台：WebView ──────────────────────────────────────────────────
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
          onLoad={() => setLoaded(true)}
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
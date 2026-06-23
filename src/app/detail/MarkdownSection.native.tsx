// ─── README 渲染（Native: iOS / Android）— WebView + marked + highlight.js ──
import React, { useState } from 'react';
import { View, Text, useWindowDimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import { buildReadmeHtml } from './_readmeUtils';

interface Props {
  content: string;
  owner: string;
  repo: string;
}

export default function MarkdownSection({ content, owner, repo }: Props) {
  const [webViewHeight, setWebViewHeight] = useState(200);
  const { width } = useWindowDimensions();

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

  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, marginTop: 4 }}>
      <Text style={{ fontSize: 15, fontWeight: '700', color: '#1A1A1A', marginBottom: 10 }}>README</Text>
      <WebView
        source={{ html }}
        style={{ width: width - 64, height: webViewHeight }}
        scrollEnabled={false}
        javaScriptEnabled={true}
        originWhitelist={['*']}
        onMessage={(e: any) => {
          try {
            const data = JSON.parse(e.nativeEvent.data);
            if (data.type === 'height' && data.height > 0) {
              setWebViewHeight(data.height);
            }
          } catch { /* ignore */ }
        }}
        onError={() => {}}
      />
    </View>
  );
}
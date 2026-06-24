// ─── README 渲染 — react-native-marked 原生方案（零 CDN、零 WebView、零时序问题）──
import React from 'react';
import { View, Text } from 'react-native';
import Markdown from 'react-native-marked';

interface Props {
  content: string;
  owner: string;
  repo: string;
}

export default function MarkdownSection({ content, owner, repo }: Props) {
  const baseUrl = `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/`;

  if (!content) return null;

  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, marginTop: 4 }}>
      <Text style={{ fontSize: 15, fontWeight: '700', color: '#1A1A1A', marginBottom: 10 }}>README</Text>
      <Markdown
        value={content}
        baseUrl={baseUrl}
        flatListProps={{
          initialNumToRender: 12,
          scrollEnabled: false,
          nestedScrollEnabled: false,
        }}
        styles={{
          h1: { fontSize: 22, fontWeight: '700', color: '#1F2328' },
          h2: { fontSize: 18, fontWeight: '700', color: '#1F2328' },
          h3: { fontSize: 16, fontWeight: '600', color: '#1F2328' },
          h4: { fontSize: 14, fontWeight: '600', color: '#1F2328' },
          h5: { fontSize: 13, fontWeight: '600', color: '#1F2328' },
          h6: { fontSize: 12, fontWeight: '600', color: '#666' },
          codespan: { fontFamily: 'monospace', fontSize: 12, backgroundColor: 'rgba(175,184,193,0.2)' },
          link: { color: '#0969da' },
        }}
        theme={{
          colors: {
            code: '#1F2328',
            link: '#0969da',
            text: '#1F2328',
            border: '#d8dee4',
          },
        }}
      />
    </View>
  );
}
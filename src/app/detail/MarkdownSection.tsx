// ─── README 渲染 — react-native-marked（纯 JS，全平台兼容）──────────────────
import React from 'react';
import { View, Text } from 'react-native';
import Markdown from 'react-native-marked';

interface Props {
  content: string;
  owner: string;
  repo: string;
}

export default function MarkdownSection({ content, owner, repo }: Props) {
  if (!content) return null;

  const cleaned = content.replace(/^---[\s\S]*?---\r?\n?/, '').trim();
  if (!cleaned) return null;

  const baseUrl = `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/`;

  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, marginTop: 4 }}>
      <Text style={{ fontSize: 15, fontWeight: '700', color: '#1A1A1A', marginBottom: 10 }}>README</Text>
      <Markdown
        value={cleaned}
        baseUrl={baseUrl}
        flatListProps={{
          scrollEnabled: false,
          nestedScrollEnabled: false,
          showsVerticalScrollIndicator: false,
        }}
        styles={{
          h1: { fontSize: 24, fontWeight: '700', borderBottomWidth: 1, borderBottomColor: '#d8dee4', paddingBottom: 7, marginBottom: 12, marginTop: 20, color: '#1F2328' },
          h2: { fontSize: 20, fontWeight: '600', borderBottomWidth: 1, borderBottomColor: '#d8dee4', paddingBottom: 6, marginBottom: 10, marginTop: 20, color: '#1F2328' },
          h3: { fontSize: 17, fontWeight: '600', marginBottom: 8, marginTop: 16, color: '#1F2328' },
          h4: { fontSize: 15, fontWeight: '600', marginBottom: 6, marginTop: 14, color: '#1F2328' },
          h5: { fontSize: 14, fontWeight: '600', marginBottom: 4, marginTop: 12, color: '#1F2328' },
          h6: { fontSize: 13, fontWeight: '600', color: '#656d76', marginBottom: 4, marginTop: 10 },
          text: { fontSize: 14, lineHeight: 22, color: '#1F2328' },
          link: { color: '#0969da' },
          blockquote: { borderLeftWidth: 3, borderLeftColor: '#d8dee4', paddingLeft: 12, marginBottom: 12 },
          code: { backgroundColor: '#f6f8fa', borderRadius: 6, padding: 12, marginBottom: 10 },
          codespan: { backgroundColor: 'rgba(175,184,193,0.2)', borderRadius: 3, paddingHorizontal: 4, paddingVertical: 2, fontFamily: 'monospace', fontSize: 12, color: '#1F2328' },
          hr: { borderTopWidth: 1, borderTopColor: '#d8dee4', marginVertical: 20 },
          image: { resizeMode: 'contain' },
          table: { borderWidth: 1, borderColor: '#d8dee4', borderRadius: 6, marginBottom: 10 },
          tableCell: { borderWidth: 0.5, borderColor: '#d8dee4', padding: 8 },
          tableRow: { borderBottomWidth: 0.5, borderBottomColor: '#d8dee4' },
          li: { fontSize: 14, lineHeight: 22, color: '#1F2328', marginBottom: 2 },
          paragraph: { marginBottom: 10 },
          em: { fontStyle: 'italic' },
          strong: { fontWeight: '700' },
          strikethrough: { textDecorationLine: 'line-through', color: '#656d76' },
        }}
      />
    </View>
  );
}
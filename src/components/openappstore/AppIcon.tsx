import React, { useState, useMemo, useEffect } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import LetterAvatar from './LetterAvatar';

interface AppIconProps {
  owner?: string;
  repo?: string;
  url?: string | null;
  name: string;
  size?: number;
  className?: string;
}

function isValidHttpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function ensureAvatarUrl(url: string | null | undefined, owner: string): string | null {
  if (url && isValidHttpUrl(url)) return url;
  // 直接使用 GitHub 用户名头像 URL（无需数字 ID，稳定可用）
  if (owner) return `https://github.com/${owner}.png?size=120`;
  return null;
}

export default function AppIcon({ owner = '', url, name, size = 48, className = '' }: AppIconProps) {
  const finalUrl = useMemo(() => ensureAvatarUrl(url, owner), [url, owner]);
  const [error, setError] = useState(false);

  // finalUrl 变化时重置错误状态，防止旧的失败状态阻止新 URL 加载
  useEffect(() => { setError(false); }, [finalUrl]);

  if (!finalUrl || error) {
    return <LetterAvatar name={name} size={size} className={className} />;
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.24,
        overflow: 'hidden',
        backgroundColor: '#F5F5F5',
      }}
    >
      <Image
        source={{ uri: finalUrl }}
        style={{ width: size, height: size }}
        contentFit="cover"
        transition={200}
        onError={() => setError(true)}
        cachePolicy="memory-disk"
      />
    </View>
  );
}

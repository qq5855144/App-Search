import React, { useState, useEffect } from 'react';
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
  /** expo-image 加载优先级，榜单前几名传 "high" */
  priority?: 'low' | 'normal' | 'high';
}

/**
 * 规范化 avatar URL：
 * - 传入有效 HTTP URL 直接使用
 * - github.com/*.png 跳转链转为 avatars CDN 直链
 * - 无 URL 时用 owner 构造 GitHub 官方 CDN 直链（无需额外 API 请求）
 */
function resolveAvatarUrl(url: string | null | undefined, owner: string): string | null {
  if (url) {
    try {
      const u = new URL(url);
      if (u.protocol === 'http:' || u.protocol === 'https:') {
        if (url.includes('github.com') && url.endsWith('.png')) {
          const m = url.match(/github\.com\/([^/?]+)\.png/);
          if (m) return `https://avatars.githubusercontent.com/${m[1]}?size=120`;
        }
        return url;
      }
    } catch { /* invalid url */ }
  }
  if (owner) return `https://avatars.githubusercontent.com/${owner}?size=120`;
  return null;
}

export default function AppIcon({
  owner = '', url, name, size = 48, className = '', priority = 'normal',
}: AppIconProps) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(() => resolveAvatarUrl(url, owner));
  const [error, setError] = useState(false);

  // url/owner 变化时同步重置（纯同步，无 API 请求）
  useEffect(() => {
    setResolvedUrl(resolveAvatarUrl(url, owner));
    setError(false);
  }, [url, owner]);

  if (!resolvedUrl || error) {
    return <LetterAvatar name={name} size={size} className={className} />;
  }

  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.24, overflow: 'hidden', backgroundColor: '#F5F5F5' }}>
      <Image
        source={{ uri: resolvedUrl }}
        style={{ width: size, height: size }}
        contentFit="cover"
        transition={200}
        priority={priority}
        onError={() => setError(true)}
        cachePolicy="memory-disk"
        recyclingKey={owner || resolvedUrl}
      />
    </View>
  );
}

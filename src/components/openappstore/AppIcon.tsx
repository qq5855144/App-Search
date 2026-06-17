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

// 模块级缓存：owner → 数字 ID 头像 URL，避免 FlatList 滚动时重复请求
const _ownerAvatarCache = new Map<string, string>();
// 正在请求中的 owner，防止并发重复请求
const _pendingFetch = new Set<string>();

function isValidHttpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** 统一规范化 avatar URL，优先使用数字 ID 直链 */
function normalizeAvatarUrl(url: string | null | undefined, owner: string): string | null {
  if (url && isValidHttpUrl(url)) {
    // github.com/*.png 跳转链 → 转为 CDN 直链
    if (url.includes('github.com') && url.endsWith('.png')) {
      const match = url.match(/github\.com\/([^/?]+)\.png/);
      if (match) return `https://avatars.githubusercontent.com/${match[1]}?size=120`;
    }
    return url;
  }
  // 检查模块缓存中是否已有该 owner 的数字 ID URL
  if (owner && _ownerAvatarCache.has(owner)) return _ownerAvatarCache.get(owner)!;
  // 兜底：用户名方式（稳定可用，后台会异步替换为数字 ID URL）
  if (owner) return `https://avatars.githubusercontent.com/${owner}?size=120`;
  return null;
}

/** 通过 GitHub API 获取 owner 的真实数字 ID 头像 URL，缓存到模块级 Map */
async function fetchAndCacheAvatarUrl(owner: string): Promise<string | null> {
  if (_ownerAvatarCache.has(owner)) return _ownerAvatarCache.get(owner)!;
  if (_pendingFetch.has(owner)) return null;
  _pendingFetch.add(owner);
  try {
    const res = await fetch(`https://api.github.com/users/${owner}`, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.avatar_url) {
      _ownerAvatarCache.set(owner, data.avatar_url);
      return data.avatar_url;
    }
  } catch {
    // 静默失败，保持兜底 URL
  } finally {
    _pendingFetch.delete(owner);
  }
  return null;
}

export default function AppIcon({ owner = '', url, name, size = 48, className = '' }: AppIconProps) {
  const initialUrl = useMemo(() => normalizeAvatarUrl(url, owner), [url, owner]);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(initialUrl);
  const [error, setError] = useState(false);

  // 当 url 为空且 owner 存在时，后台调 API 获取数字 ID 头像 URL
  useEffect(() => {
    setResolvedUrl(normalizeAvatarUrl(url, owner));
    setError(false);
    if (owner && (!url || !isValidHttpUrl(url))) {
      fetchAndCacheAvatarUrl(owner).then((apiUrl) => {
        if (apiUrl) setResolvedUrl(apiUrl);
      });
    }
  }, [url, owner]);

  if (!resolvedUrl || error) {
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
        source={{ uri: resolvedUrl }}
        style={{ width: size, height: size }}
        contentFit="cover"
        transition={200}
        onError={() => {
          // URL 加载失败时尝试 API 获取
          if (owner) {
            _ownerAvatarCache.delete(owner); // 清除可能的错误缓存
            fetchAndCacheAvatarUrl(owner).then((apiUrl) => {
              if (apiUrl) { setResolvedUrl(apiUrl); setError(false); }
              else setError(true);
            });
          } else {
            setError(true);
          }
        }}
        cachePolicy="memory-disk"
        recyclingKey={owner || resolvedUrl}
      />
    </View>
  );
}

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
  /** expo-image 加载优先级，榜单前几名传 "high" */
  priority?: 'low' | 'normal' | 'high';
}

// 模块级缓存：owner → 经 API 确认的数字 ID 头像 URL（仅在图片加载失败时才写入）
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

/**
 * 统一规范化 avatar URL
 * - 有效 URL 直接用（avatars.githubusercontent.com 用户名 CDN 直链无需额外 API）
 * - 无 URL 时按 owner 构造用户名 CDN URL（GitHub 官方稳定直链）
 */
function normalizeAvatarUrl(url: string | null | undefined, owner: string): string | null {
  // 优先使用 API fallback 缓存（仅在上次加载失败后才有值）
  if (owner && _ownerAvatarCache.has(owner)) return _ownerAvatarCache.get(owner)!;
  if (url && isValidHttpUrl(url)) {
    // github.com/*.png 跳转链 → 转为 CDN 直链
    if (url.includes('github.com') && url.endsWith('.png')) {
      const match = url.match(/github\.com\/([^/?]+)\.png/);
      if (match) return `https://avatars.githubusercontent.com/${match[1]}?size=120`;
    }
    return url;
  }
  // 用户名 CDN 直链：GitHub 官方支持，无需重定向，直接命中 CDN
  if (owner) return `https://avatars.githubusercontent.com/${owner}?size=120`;
  return null;
}

/**
 * 仅在图片加载失败时调用：通过 GitHub API 获取数字 ID 头像 URL 作为 fallback
 * 不在组件挂载时主动调用，避免 N 个并发请求导致乱序加载
 */
async function fetchAvatarUrlFallback(owner: string): Promise<string | null> {
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
    // 静默失败
  } finally {
    _pendingFetch.delete(owner);
  }
  return null;
}

export default function AppIcon({ owner = '', url, name, size = 48, className = '', priority = 'normal' }: AppIconProps) {
  const initialUrl = useMemo(() => normalizeAvatarUrl(url, owner), [url, owner]);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(initialUrl);
  const [error, setError] = useState(false);

  // url/owner 变化时重置状态（不主动发起 API 请求）
  useEffect(() => {
    setResolvedUrl(normalizeAvatarUrl(url, owner));
    setError(false);
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
        priority={priority}
        onError={() => {
          // 仅在加载失败时才调 API 获取 fallback URL，不影响其他正常加载的图片
          if (owner) {
            _ownerAvatarCache.delete(owner);
            fetchAvatarUrlFallback(owner).then((apiUrl) => {
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

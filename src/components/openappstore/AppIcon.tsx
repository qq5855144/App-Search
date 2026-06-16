import React, { useState, useMemo } from 'react';
import { View, Text } from 'react-native';
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

function isValidHttpUrl(string: string): boolean {
  let url;
  try {
    url = new URL(string);
  } catch (_) {
    return false;
  }
  return url.protocol === 'http:' || url.protocol === 'https:';
}

function ensureAvatarUrl(url: string | null | undefined, owner: string): string | null {
  if (url && isValidHttpUrl(url)) {
    return url;
  }
  if (owner) {
    return `https://github.com/${owner}.png`;
  }
  return null;
}

export default function AppIcon({ owner = '', url, name, size = 48, className = '' }: AppIconProps) {
  const finalUrl = useMemo(() => ensureAvatarUrl(url, owner), [url, owner]);
  const [error, setError] = useState(false);

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
        cachePolicy="disk"
      />
    </View>
  );
}

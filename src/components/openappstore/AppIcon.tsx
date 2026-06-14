/**
 * 应用图标组件
 *
 * GitHub API 不提供仓库的真实应用图标，仅有 owner.avatar_url（所有者/组织头像）。
 * 本组件直接展示 avatar_url，加载失败时降级为首字母占位（LetterAvatar）。
 *
 * 渲染方案：用 View 包裹 Image 并在 View 上设置 borderRadius + overflow:'hidden'。
 * 直接在 expo-image style 上设置 borderRadius 在部分平台只裁剪容器边框，
 * 不裁剪图片内容，导致图片溢出；wrapper View 方案可跨平台可靠裁剪。
 */
import { View } from 'react-native';
import { Image } from 'expo-image';
import LetterAvatar from './LetterAvatar';
import { useState } from 'react';

interface AppIconProps {
  owner?: string;
  repo?: string;
  url: string | null;
  name: string;
  size?: number;
  className?: string;
}

export default function AppIcon({ url, name, size = 48, className = '' }: AppIconProps) {
  const [error, setError] = useState(false);

  if (!url || error) {
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
        source={{ uri: url }}
        style={{ width: size, height: size }}
        contentFit="contain"
        transition={200}
        onError={() => setError(true)}
      />
    </View>
  );
}

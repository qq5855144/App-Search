import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import AppIcon from './AppIcon';
import PlatformTag from './PlatformTag';
import { Ionicons } from '@expo/vector-icons';
import type { AppItem } from '@/types';

interface AppCardProps {
  app: AppItem;
}

export default function AppCard({ app }: AppCardProps) {
  const router = useRouter();

  const handlePress = () => {
    router.push({
      pathname: `/detail/${app.id}`,
      params: { owner: app.owner, repo: app.repo },
    } as any);
  };

  return (
    <Pressable
      onPress={handlePress}
      style={{
        backgroundColor: '#FFFFFF',
        marginHorizontal: 16,
        marginBottom: 12,
        padding: 16,
        borderRadius: 16,
        boxShadow: [{ offsetX: 0, offsetY: 1, blurRadius: 4, color: 'rgba(0,0,0,0.07)' }],
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <AppIcon owner={app.owner} repo={app.repo} url={app.avatar_url} name={app.name} size={56} />

        {/* 应用信息 */}
        <View style={{ flex: 1, marginLeft: 12, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text
              style={{ flex: 1, fontSize: 15, fontWeight: '600', color: '#1A1A1A' }}
              numberOfLines={1}
            >
              {app.name}
            </Text>
            {/* 查看按钮 — 跳转详情页选择安装包 */}
            <View
              style={{
                marginLeft: 10,
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderRadius: 24,
                borderWidth: 1.5,
                borderColor: '#1677FF',
                backgroundColor: '#FFFFFF',
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#1677FF' }}>查看</Text>
            </View>
          </View>

          {/* 功能简介 */}
          {app.description ? (
            <Text
              style={{ fontSize: 13, color: '#666666', lineHeight: 18 }}
              numberOfLines={2}
            >
              {app.description}
            </Text>
          ) : null}

          {/* 语言、平台标签、Star/Fork */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
            {app.language ? (
              <Text style={{ fontSize: 11, color: '#999999' }}>{app.language}</Text>
            ) : null}
            {app.platforms.slice(0, 2).map((p) => (
              <PlatformTag key={p} platform={p} />
            ))}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: 2 }}>
              <Ionicons name="star" size={11} color="#FAAD14" />
              <Text style={{ fontSize: 11, color: '#999999' }}>{app.stars.toLocaleString()}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Ionicons name="git-branch-outline" size={11} color="#999999" />
              <Text style={{ fontSize: 11, color: '#999999' }}>{app.forks.toLocaleString()}</Text>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

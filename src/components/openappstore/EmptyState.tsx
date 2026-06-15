import React from 'react';
import { View, Text } from 'react-native';
import { PackageOpen } from 'lucide-react-native';

interface EmptyStateProps {
  title?: string;
  description?: string;
}

export default function EmptyState({ title = '暂无数据', description = '' }: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center py-20">
      <PackageOpen size={48} color="#999999" />
      <Text className="text-muted-foreground mt-3 text-base font-medium">{title}</Text>
      {description ? <Text className="text-muted-foreground mt-1 text-sm">{description}</Text> : null}
    </View>
  );
}

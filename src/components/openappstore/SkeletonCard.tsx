import React from 'react';
import { View } from 'react-native';

export default function SkeletonCard() {
  return (
    <View className="bg-card mx-4 mb-3 p-4 rounded-2xl" style={{ opacity: 0.6 }}>
      <View className="flex-row items-center">
        <View className="w-14 h-14 rounded-xl bg-muted" />
        <View className="flex-1 ml-3 gap-1.5">
          <View className="h-4 w-32 rounded bg-muted" />
          <View className="h-3 w-20 rounded bg-muted" />
          <View className="h-3 w-24 rounded bg-muted" />
        </View>
        <View className="h-8 w-16 rounded-full bg-muted" />
      </View>
    </View>
  );
}

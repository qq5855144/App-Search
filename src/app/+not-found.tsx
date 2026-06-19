import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';

/**
 * 当路由匹配失败时展示此页，防止完全白屏
 */
export default function NotFound() {
  const router = useRouter();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 8 }}>页面不存在</Text>
      <Text style={{ color: '#666', marginBottom: 24, textAlign: 'center' }}>
        路由未匹配，请返回首页
      </Text>
      <Pressable
        onPress={() => router.replace('/(tabs)')}
        style={{ backgroundColor: '#2563eb', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 }}
      >
        <Text style={{ color: '#fff', fontWeight: '600' }}>返回首页</Text>
      </Pressable>
    </View>
  );
}

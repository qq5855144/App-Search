// 【诊断模式】极简组件 — 确认 React 是否正常挂载
import React from 'react';
import { View, Text } from 'react-native';

export default function HomeTab() {
  return (
    <View style={{ flex: 1, backgroundColor: '#e74c3c', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontSize: 28, fontWeight: 'bold' }}>✅ React 已挂载</Text>
      <Text style={{ color: '#fff', fontSize: 16, marginTop: 12 }}>如果你看到这个红色屏幕，说明应用加载正常</Text>
    </View>
  );
}

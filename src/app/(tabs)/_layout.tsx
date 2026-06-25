import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// 内容区高度（图标 + 文字，不含系统导航条 inset）
// Android 60 / iOS 54：足够容纳图标+标签文字
const TAB_CONTENT_HEIGHT = Platform.OS === 'ios' ? 54 : 60;
const TAB_PADDING_BOTTOM = Platform.OS === 'ios' ? 10 : 8;

export default function TabsLayout() {
  // insets.bottom：Android 虚拟导航按钮高度 / iOS Home Indicator 高度
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      initialRouteName="home"
      screenOptions={{
        tabBarActiveTintColor: '#1677FF',
        tabBarInactiveTintColor: '#999999',
        tabBarStyle: {
          // 总高度 = 内容区 + 系统导航条占用空间，确保不遮挡也不重叠
          height: TAB_CONTENT_HEIGHT + insets.bottom,
          paddingBottom: TAB_PADDING_BOTTOM + insets.bottom,
          paddingTop: 4,
          borderTopWidth: 0,
          backgroundColor: Platform.OS === 'ios' ? 'rgba(255,255,255,0.92)' : '#FFFFFF',
          // 左上、右上圆角
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          // 圆角区域显示阴影代替边框
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 12,
        },
        tabBarHideOnKeyboard: true,
        headerShown: false,
      }}
    >
      <Tabs.Screen name="home" options={{ title: '首页', tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="discover" options={{ title: '发现', tabBarIcon: ({ color, size }) => <Ionicons name="compass-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="ranking" options={{ title: '榜单', tabBarIcon: ({ color, size }) => <Ionicons name="trophy-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="search" options={{ title: '搜索', tabBarIcon: ({ color, size }) => <Ionicons name="search-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: '我的', tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} /> }} />
    </Tabs>
  );
}


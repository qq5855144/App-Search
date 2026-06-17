import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';

/** 带触感的 Tab 按钮 */
function HapticTabButton(props: any) {
  return (
    <Pressable
      {...props}
      onPress={(e) => {
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
        props.onPress?.(e);
      }}
    />
  );
}

const TAB_HEIGHT = Platform.OS === 'ios' ? 64 : 60;
const TAB_PADDING_BOTTOM = Platform.OS === 'ios' ? 10 : 6;

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#1677FF',
        tabBarInactiveTintColor: '#999999',
        tabBarStyle: {
          height: TAB_HEIGHT,
          paddingBottom: TAB_PADDING_BOTTOM,
          paddingTop: 4,
          borderTopWidth: 0.5,
          borderTopColor: '#E8E8E8',
          backgroundColor: Platform.OS === 'ios' ? 'rgba(255,255,255,0.92)' : '#FFFFFF',
        },
        tabBarHideOnKeyboard: true,
        tabBarButton: (props) => <HapticTabButton {...props} />,
        headerShown: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: '首页', tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="discover" options={{ title: '发现', tabBarIcon: ({ color, size }) => <Ionicons name="compass-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="ranking" options={{ title: '榜单', tabBarIcon: ({ color, size }) => <Ionicons name="trophy-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="search" options={{ title: '搜索', tabBarIcon: ({ color, size }) => <Ionicons name="search-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: '我的', tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} /> }} />
    </Tabs>
  );
}


import React, { useCallback, useRef } from 'react';
import { Tabs, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, BackHandler } from 'react-native';

const TAB_HEIGHT = Platform.OS === 'ios' ? 64 : 60;
const TAB_PADDING_BOTTOM = Platform.OS === 'ios' ? 10 : 6;

export default function TabsLayout() {
  // Android 系统返回键：Tabs 可见时注册，Stack 推入子页面时自动注销
  // 子页面（downloads/detail 等）的返回由原生 Fragment 处理，无需 JS 干预
  const backPressCount = useRef(0);
  const backPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useFocusEffect(useCallback(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      backPressCount.current += 1;
      if (backPressCount.current === 1) {
        backPressTimer.current = setTimeout(() => { backPressCount.current = 0; }, 2000);
        return true; // 第一次：拦截，防止误触退出
      }
      if (backPressTimer.current) clearTimeout(backPressTimer.current);
      backPressCount.current = 0;
      return false; // 第二次：放行，系统退出
    });
    return () => {
      sub.remove();
      if (backPressTimer.current) clearTimeout(backPressTimer.current);
      backPressCount.current = 0;
    };
  }, []));

  return (
    <Tabs
      initialRouteName="home"
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


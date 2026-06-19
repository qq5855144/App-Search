import React, { useEffect, useRef } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, Pressable, BackHandler, Animated, View, Text } from 'react-native';

const TAB_HEIGHT = Platform.OS === 'ios' ? 64 : 60;
const TAB_PADDING_BOTTOM = Platform.OS === 'ios' ? 10 : 6;

export default function TabsLayout() {
  // Android 系统返回键：在 Tabs 根屏幕拦截，连按两次退出
  // 注：放在 (tabs)/_layout.tsx 而非 _layout.tsx，
  //   因为 _layout.tsx 是 Stack 的父容器（导航树之外），useNavigation 拿不到正确状态；
  //   而此处 Tabs 处于 Stack 内部，是真正的"根屏幕"。
  //   当子页面（downloads/detail 等）打开时，Stack 内置 BackHandler 会先响应并 goBack()，
  //   本 handler 不会触发，无需手动 canGoBack() 判断。
  const backPressCount = useRef(0);
  const backPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showExitToast = () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    toastTimer.current = setTimeout(() => {
      Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start();
    }, 1800);
  };

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      backPressCount.current += 1;
      if (backPressCount.current === 1) {
        showExitToast();
        backPressTimer.current = setTimeout(() => { backPressCount.current = 0; }, 2000);
        return true;
      }
      if (backPressTimer.current) clearTimeout(backPressTimer.current);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      backPressCount.current = 0;
      BackHandler.exitApp();
      return true;
    });
    return () => {
      sub.remove();
      if (backPressTimer.current) clearTimeout(backPressTimer.current);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={{ flex: 1 }}>
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
          headerShown: false,
        }}
      >
        <Tabs.Screen name="index" options={{ title: '首页', tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} /> }} />
        <Tabs.Screen name="discover" options={{ title: '发现', tabBarIcon: ({ color, size }) => <Ionicons name="compass-outline" size={size} color={color} /> }} />
        <Tabs.Screen name="ranking" options={{ title: '榜单', tabBarIcon: ({ color, size }) => <Ionicons name="trophy-outline" size={size} color={color} /> }} />
        <Tabs.Screen name="search" options={{ title: '搜索', tabBarIcon: ({ color, size }) => <Ionicons name="search-outline" size={size} color={color} /> }} />
        <Tabs.Screen name="profile" options={{ title: '我的', tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} /> }} />
      </Tabs>
      {/* 退出提示 Toast */}
      {Platform.OS === 'android' && (
        <Animated.View
          pointerEvents="none"
          style={{ position: 'absolute', bottom: TAB_HEIGHT + 8, left: 0, right: 0, alignItems: 'center', opacity: toastOpacity }}
        >
          <View style={{ backgroundColor: 'rgba(0,0,0,0.75)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 24 }}>
            <Text style={{ color: '#fff', fontSize: 14 }}>再按一次退出应用</Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

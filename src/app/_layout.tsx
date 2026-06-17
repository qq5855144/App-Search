import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { View, Text, Pressable, Platform } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { initToken } from '@/lib/token';
import "../global.css";

// 阻止启动屏自动隐藏，等待资源就绪后手动隐藏
SplashScreen.preventAutoHideAsync().catch(() => {});

/** 全局错误边界：捕获任何渲染错误，显示可见提示而非白屏 */
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: string | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(e: any) {
    return { error: e?.message || String(e) };
  }
  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#fff' }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#d32f2f', marginBottom: 12 }}>
            应用启动出错
          </Text>
          <Text style={{ fontSize: 13, color: '#555', textAlign: 'center', marginBottom: 20 }}>
            {this.state.error}
          </Text>
          <Pressable
            onPress={() => this.setState({ error: null })}
            style={{ backgroundColor: '#1677FF', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 }}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>重试</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function RootLayout() {
  useEffect(() => {
    // 初始化 Token，完成后隐藏启动屏
    initToken()
      .catch(() => {})
      .finally(() => {
        SplashScreen.hideAsync().catch(() => {});
      });
  }, []);

  return (
    <ErrorBoundary>
      <SafeAreaProvider style={{ flex: 1 }}>
        <StatusBar style="dark" backgroundColor="transparent" translucent={Platform.OS === 'android'} />
        <Stack
          screenOptions={{
            headerShown: false,
            // 原生滑入动画，比 'none' 更有 app 感
            animation: Platform.OS === 'android' ? 'fade_from_bottom' : 'default',
            // Android 13+ 预测性返回手势
            gestureEnabled: true,
          }}
        >
          <Stack.Screen name="(tabs)" options={{ animation: 'none' }} />
          <Stack.Screen name="detail" />
          <Stack.Screen name="downloads" />
          <Stack.Screen name="favorites" />
          <Stack.Screen name="search-history" />
          <Stack.Screen name="+not-found" />
        </Stack>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

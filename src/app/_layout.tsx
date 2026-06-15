import { Stack } from 'expo-router';
import { PortalHost } from '@rn-primitives/portal';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { View, Text, Platform } from 'react-native';
import { DownloadProvider } from '@/ctx/DownloadContext';
import "../global.css";

// ─── Web 端错误诊断（临时调试用）─────────────────────────────────────
// 将 JS 错误注入到页面 DOM，即使 React 完全崩溃也能看到错误信息
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  const inject = (msg: string, bg: string, top: string) => {
    try {
      const el = document.createElement('div');
      el.style.cssText = `position:fixed;${top};left:0;right:0;padding:14px 16px;
        background:${bg};color:#fff;z-index:999999;font-size:13px;
        word-break:break-all;font-family:monospace;line-height:1.4;
        white-space:pre-wrap;max-height:40vh;overflow-y:auto`;
      el.textContent = msg;
      document.body?.appendChild(el);
    } catch { /* 若 body 还未准备好则忽略 */ }
  };
  (window as any).onerror = (msg: any, src: any, line: any, col: any, err: any) => {
    inject(`[JS Error]\n${msg}\n${src}:${line}:${col}\n${err?.stack || ''}`, '#c0392b', 'top:0');
    return false;
  };
  window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
    inject(`[Promise Rejection]\n${e.reason?.stack || e.reason || '(unknown)'}`, '#e67e22', 'top:0');
  });
}

// Native 端保留 GestureHandlerRootView；Web 端用 plain View 避免潜在兼容性问题
const RootWrapper = Platform.OS === 'web'
  ? ({ children }: { children: React.ReactNode }) => <View style={{ flex: 1 }}>{children}</View>
  : ({ children }: { children: React.ReactNode }) => (
      <GestureHandlerRootView style={{ flex: 1 }}>{children}</GestureHandlerRootView>
    );

function ErrorFallback({ error }: { error: Error }) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#fff' }}>
      <Text style={{ fontSize: 18, fontWeight: 'bold', color: 'red' }}>应用加载失败</Text>
      <Text style={{ marginTop: 10, color: '#666', fontSize: 12 }}>{error?.message || String(error)}</Text>
    </View>
  );
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: any) {
    console.error('[ErrorBoundary] caught:', error?.message, info);
  }
  render() {
    if (this.state.hasError) return <ErrorFallback error={this.state.error!} />;
    return this.props.children;
  }
}

export default function RootLayout() {
  useEffect(() => {
    // 后台静默初始化 token，不阻塞路由渲染
    import('@/lib/token')
      .then((mod) => mod.initToken())
      .catch((e: any) => console.warn('[RootLayout] initToken failed:', e?.message));
  }, []);

  // Stack 始终渲染，确保 expo-router 路由上下文立即建立
  return (
    <ErrorBoundary>
      <RootWrapper>
        <SafeAreaProvider style={{ flex: 1 }}>
          <DownloadProvider>
            <StatusBar style="dark" backgroundColor="transparent" translucent />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(app)" />
              <Stack.Screen name="(auth)" />
            </Stack>
            <PortalHost />
          </DownloadProvider>
        </SafeAreaProvider>
      </RootWrapper>
    </ErrorBoundary>
  );
}

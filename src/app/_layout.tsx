import { Stack } from 'expo-router';
import { PortalHost } from '@rn-primitives/portal';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { View, Text, Platform } from 'react-native';
import { DownloadProvider } from '@/ctx/DownloadContext';
import "../global.css";

// 延迟导入 initToken，避免其依赖的模块在 Web 端初始化时崩溃
let initTokenModule: any = null;

function ErrorFallback({ error }: { error: Error }) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#fff' }}>
      <Text style={{ fontSize: 18, fontWeight: 'bold', color: 'red' }}>应用加载失败</Text>
      <Text style={{ marginTop: 10, color: '#666', fontSize: 12 }}>{error?.message || String(error)}</Text>
    </View>
  );
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: any) {
    console.error('[ErrorBoundary] Caught error:', error?.message, info);
  }
  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error!} />;
    }
    return this.props.children;
  }
}

// 最简单的 fallback：如果任何模块加载失败，至少展示一个可见的页面
function MinimalFallback() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#fff' }}>
      <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#333' }}>页面加载中...</Text>
      <Text style={{ marginTop: 10, color: '#999', fontSize: 12 }}>
        Platform: {Platform.OS} | 如果持续白屏请刷新页面
      </Text>
    </View>
  );
}

// Native 端保留 GestureHandlerRootView；Web 端用 plain View 避免潜在兼容性问题
const RootWrapper = Platform.OS === 'web'
  ? ({ children }: { children: React.ReactNode }) => <View style={{ flex: 1 }}>{children}</View>
  : ({ children }: { children: React.ReactNode }) => (
      <GestureHandlerRootView style={{ flex: 1 }}>{children}</GestureHandlerRootView>
    );

export default function RootLayout() {
  const [ready, setReady] = React.useState(false);
  const [fatalError, setFatalError] = React.useState<string | null>(null);

  useEffect(() => {
    console.log('[RootLayout] Mounted, platform:', Platform.OS);
    // 延迟加载 token 模块，避免 Web 端初始化崩溃
    try {
      import('@/lib/token').then((mod) => {
        initTokenModule = mod;
        mod.initToken().catch((e: any) => {
          console.warn('[RootLayout] initToken failed:', e?.message);
        });
        setReady(true);
      }).catch((e: any) => {
        console.error('[RootLayout] Failed to load token module:', e?.message);
        setFatalError(e?.message || 'Token module load failed');
        setReady(true);
      });
    } catch (e: any) {
      console.error('[RootLayout] import failed:', e?.message);
      setFatalError(e?.message || 'Import failed');
      setReady(true);
    }
  }, []);

  if (fatalError) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#fff' }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: 'red' }}>致命错误</Text>
        <Text style={{ marginTop: 10, color: '#666' }}>{fatalError}</Text>
      </View>
    );
  }

  if (!ready) {
    return <MinimalFallback />;
  }

  return (
    <ErrorBoundary>
      <RootWrapper>
        <SafeAreaProvider>
          <DownloadProvider>
            <StatusBar style="dark" backgroundColor="transparent" translucent />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(app)" />
            </Stack>
            <PortalHost />
          </DownloadProvider>
        </SafeAreaProvider>
      </RootWrapper>
    </ErrorBoundary>
  );
}

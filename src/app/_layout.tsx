import { Stack } from 'expo-router';
import { PortalHost } from '@rn-primitives/portal';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { DownloadProvider } from '@/ctx/DownloadContext';
import "../global.css";

// Web 端用 plain View，Native 端用 GestureHandlerRootView
function RootWrapper({ children }: { children: React.ReactNode }) {
  if (Platform.OS === 'web') {
    return <View style={{ flex: 1 }}>{children}</View>;
  }
  // 动态导入仅在 Native 端执行，避免 Web bundle 拉取 gesture handler
  const { GestureHandlerRootView } =
    require('react-native-gesture-handler') as typeof import('react-native-gesture-handler');
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {children}
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  useEffect(() => {
    import('@/lib/token')
      .then((mod) => mod.initToken())
      .catch((e: any) => console.warn('[RootLayout] initToken failed:', e?.message));
  }, []);

  return (
    <RootWrapper>
      <SafeAreaProvider style={{ flex: 1 }}>
        <DownloadProvider>
          <StatusBar style="dark" backgroundColor="transparent" translucent />
          <Stack
            initialRouteName="(tabs)"
            screenOptions={{ headerShown: false, animation: 'none' }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="detail" />
            <Stack.Screen name="downloads" />
            <Stack.Screen name="favorites" />
            <Stack.Screen name="search-history" />
          </Stack>
          <PortalHost />
        </DownloadProvider>
      </SafeAreaProvider>
    </RootWrapper>
  );
}

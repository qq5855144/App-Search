/**
 * WebShell — web 套壳核心组件
 *
 * 架构说明：
 *   native 端（Android/iOS）用 WebView 加载 web 版本的 URL，
 *   浏览器内置的 history 栈天然支持系统返回键：
 *     - canGoBack = true  → webRef.goBack()，等同于浏览器点击"后退"
 *     - canGoBack = false → Toast 提示 + 二次按下退出
 *
 *   web 端不渲染本组件（index.tsx 直接 Redirect 到 /(tabs)）。
 *
 * URL 配置：
 *   在项目根目录的 .env 文件中设置：
 *     EXPO_PUBLIC_WEB_URL=https://your-deployed-app.vercel.app
 *   未设置时显示配置引导页面。
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Pressable,
  Text,
  ToastAndroid,
  View,
} from 'react-native';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// web 版本部署地址，通过 .env 文件的 EXPO_PUBLIC_WEB_URL 配置
const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? '';

export default function WebShell() {
  const webRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastBackTime = useRef(0);
  const insets = useSafeAreaInsets();

  // Android 系统返回键：利用 WebView 内置 history 栈，天然等同于浏览器后退
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack && webRef.current) {
        webRef.current.goBack();
        return true;
      }
      // 已在根页面，双击退出
      const now = Date.now();
      if (now - lastBackTime.current < 2000) {
        BackHandler.exitApp();
        return true;
      }
      lastBackTime.current = now;
      ToastAndroid.show('再按一次退出应用', ToastAndroid.SHORT);
      return true;
    });
    return () => sub.remove();
  }, [canGoBack]);

  const onNavigationStateChange = useCallback((state: WebViewNavigation) => {
    setCanGoBack(state.canGoBack);
  }, []);

  // 未配置 URL 时显示引导页
  if (!WEB_URL) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#f5f7fa' }}>
        <StatusBar style="dark" />
        <Text style={{ fontSize: 48, marginBottom: 16 }}>⚙️</Text>
        <Text style={{ fontSize: 20, fontWeight: '700', color: '#1a1a1a', marginBottom: 8, textAlign: 'center' }}>
          配置 Web 地址
        </Text>
        <Text style={{ fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 22, marginBottom: 24 }}>
          请在项目根目录的 .env 文件中设置：
        </Text>
        <View style={{ backgroundColor: '#1a1a2e', borderRadius: 8, padding: 16, width: '100%' }}>
          <Text style={{ fontFamily: 'monospace', color: '#7dd3fc', fontSize: 13 }}>
            EXPO_PUBLIC_WEB_URL=
          </Text>
          <Text style={{ fontFamily: 'monospace', color: '#86efac', fontSize: 13 }}>
            {'  '}https://your-app.vercel.app
          </Text>
        </View>
        <Text style={{ fontSize: 13, color: '#999', marginTop: 20, textAlign: 'center', lineHeight: 20 }}>
          可将 web 版本部署到 Vercel / Netlify / GitHub Pages 等平台后填写对应地址。
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#fff', paddingTop: insets.top }}>
      <StatusBar style="dark" />

      <WebView
        ref={webRef}
        source={{ uri: WEB_URL }}
        style={{ flex: 1 }}
        onNavigationStateChange={onNavigationStateChange}
        onLoadStart={() => { setLoading(true); setError(null); }}
        onLoadEnd={() => setLoading(false)}
        onError={(e) => {
          setLoading(false);
          setError(e.nativeEvent.description || '页面加载失败');
        }}
        // 允许 WebView 内跳转（GitHub 等外部链接）
        setSupportMultipleWindows={false}
        // 开启 DOM storage，让 web 版登录 token 持久化
        domStorageEnabled
        // 允许 JS
        javaScriptEnabled

      />

      {/* 加载进度遮罩 */}
      {loading && (
        <View style={{
          position: 'absolute', top: insets.top, left: 0, right: 0, bottom: 0,
          backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
        }}>
          <ActivityIndicator size="large" color="#1677FF" />
          <Text style={{ marginTop: 12, color: '#999', fontSize: 14 }}>加载中…</Text>
        </View>
      )}

      {/* 网络错误页 */}
      {error && !loading && (
        <View style={{
          position: 'absolute', top: insets.top, left: 0, right: 0, bottom: 0,
          backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', padding: 32,
        }}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>😕</Text>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginBottom: 8 }}>
            加载失败
          </Text>
          <Text style={{ fontSize: 13, color: '#888', textAlign: 'center', marginBottom: 24, lineHeight: 20 }}>
            {error}
          </Text>
          <Pressable
            onPress={() => webRef.current?.reload()}
            style={{ backgroundColor: '#1677FF', paddingHorizontal: 28, paddingVertical: 12, borderRadius: 8 }}
          >
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>重新加载</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

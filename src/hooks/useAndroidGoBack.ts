/**
 * useAndroidGoBack — 子页面（detail / downloads / favorites / search-history）使用
 *
 * 原理：
 *   React Native BackHandler 源码（BackHandler.android.js）：
 *     当所有监听器都 return false 或 return undefined 时，BackHandler 自动调用 exitApp()。
 *   因此 "return false 透传原生" 的假设是错误的：return false = 无人处理 = 退出应用。
 *
 *   正确做法：子页面拦截事件，自己调用 router.back()，然后 return true（消费事件）。
 *
 * 用法：在子页面组件顶层调用，不需要任何参数。
 */
import { useEffect } from 'react';
import { BackHandler, Platform } from 'react-native';
import { useRouter } from 'expo-router';

export function useAndroidGoBack() {
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      // 自己处理导航，return true 消费事件，阻止 BackHandler 自动 exitApp()
      if (router.canGoBack()) {
        router.back();
      } else {
        // 兜底：canGoBack() 为 false 时回到 Tab 首页而非退出
        router.replace('/(tabs)' as any);
      }
      return true;
    });
    return () => sub.remove();
  }, [router]);
}

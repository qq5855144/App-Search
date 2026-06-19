/**
 * useAndroidExitBack — Tab 根屏幕使用（首页/发现/榜单/搜索/我的）
 *
 * 原理同 useAndroidGoBack：必须 return true 消费事件。
 * Tab 屏幕永不卸载，useEffect 只需注册一次。
 * 多个 Tab 屏幕同时注册时，LIFO 顺序确保最近激活的处理器先触发，
 * 但所有 Tab 处理器行为相同（toast/exit），不会产生冲突。
 *
 * 行为：
 *   - 第一次按返回：Toast "再按一次退出应用"
 *   - 2 秒内再按：exitApp()
 */
import { useEffect, useRef } from 'react';
import { BackHandler, Platform, ToastAndroid } from 'react-native';

export function useAndroidExitBack() {
  const lastBackTime = useRef(0);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
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
  }, []);
}

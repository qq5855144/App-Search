/**
 * 入口路由
 *
 * - native（Android / iOS）：渲染 WebShell（WebView 套壳，返回键天然有效）
 * - web：重定向到 /(tabs) 使用完整的 expo-router 导航
 */
import { Platform } from 'react-native';
import { Redirect } from 'expo-router';
import WebShell from '@/components/openappstore/WebShell';

export default function IndexScreen() {
  if (Platform.OS === 'web') {
    return <Redirect href="/(tabs)/home" />;
  }
  return <WebShell />;
}

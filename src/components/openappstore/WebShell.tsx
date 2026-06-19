/**
 * WebShell web 平台桩
 *
 * web 端不使用 WebView 套壳——index.tsx 在 Platform.OS === 'web' 时
 * 直接 <Redirect href="/(tabs)/home"> 跳走，本组件永远不会被渲染。
 * 仅用于让 Metro/webpack 在 web 构建时能正常解析该模块，
 * 避免 react-native-webview（native-only）被打包进 web bundle。
 */
export default function WebShell() {
  return null;
}

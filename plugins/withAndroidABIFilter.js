/**
 * Expo config plugin: 只保留 arm64-v8a 架构的 .so 库，移除 armeabi-v7a / x86 / x86_64
 * 预计减少 APK 体积 30-50%
 */
const { withGradleProperties } = require('expo/config-plugins');

function withAndroidABIFilter(config) {
  return withGradleProperties(config, (c) => {
    const props = c.modResults;
    // 移除已有的 reactNativeArchitectures（如果有的话）
    const idx = props.findIndex((p) => p.key === 'reactNativeArchitectures');
    if (idx >= 0) props.splice(idx, 1);
    props.push({
      type: 'property',
      key: 'reactNativeArchitectures',
      value: 'arm64-v8a',
    });
    return c;
  });
}

module.exports = withAndroidABIFilter;
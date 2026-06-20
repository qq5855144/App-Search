/* eslint-disable */
/**
 * withAndroidABIFilter.js
 *
 * 仅保留 arm64-v8a（64位真机），移除 x86 / x86_64 / armeabi-v7a，
 * 大幅减少 APK 体积并加快构建速度。
 *
 * 注意：移除 x86/x86_64 后，x86 模拟器无法运行此 APK；
 * 如需调试可临时注释本插件。
 */

const { withAppBuildGradle } = require('expo/config-plugins');

const withAndroidABIFilter = (config) => {
  return withAppBuildGradle(config, (mod) => {
    let contents = mod.modResults.contents;

    // 如果已经有 abiFilters 配置就跳过
    if (contents.includes('abiFilters')) {
      return mod;
    }

    // 在 defaultConfig { ... } 块内追加 ndk abiFilters
    contents = contents.replace(
      /(defaultConfig\s*\{[^}]*)(})/s,
      (match, inner, closing) => {
        // 避免重复插入
        if (inner.includes('abiFilters')) return match;
        return `${inner}        ndk {\n            abiFilters "arm64-v8a"\n        }\n    ${closing}`;
      }
    );

    mod.modResults.contents = contents;
    return mod;
  });
};

module.exports = withAndroidABIFilter;

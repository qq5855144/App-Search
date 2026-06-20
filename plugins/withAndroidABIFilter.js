/* eslint-disable */
/**
 * withAndroidABIFilter.js
 *
 * 仅保留 arm64-v8a（64位真机），移除 x86 / x86_64 / armeabi-v7a，
 * 大幅减少 APK 体积并加快构建速度。
 *
 * 使用 withDangerousMod 直接操作 android/app/build.gradle，
 * 与 withAndroidSplashFix 同款模式，兼容性最佳。
 *
 * 注意：移除 x86/x86_64 后，x86 模拟器无法运行此 APK。
 */

const { withDangerousMod } = require('expo/config-plugins');
const path = require('path');
const fs = require('fs');

const withAndroidABIFilter = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const buildGradlePath = path.join(
        config.modRequest.projectRoot,
        'android/app/build.gradle'
      );

      if (!fs.existsSync(buildGradlePath)) {
        console.warn('[withAndroidABIFilter] android/app/build.gradle not found, skipping');
        return config;
      }

      let contents = fs.readFileSync(buildGradlePath, 'utf8');

      // 幂等检查
      if (contents.includes('abiFilters')) {
        console.log('[withAndroidABIFilter] Already patched, skipping');
        return config;
      }

      // 在 defaultConfig { ... } 块末尾插入 ndk { abiFilters }
      contents = contents.replace(
        /(defaultConfig\s*\{)([\s\S]*?)(\n\s*\})/,
        (match, open, body, close) => {
          if (body.includes('abiFilters')) return match;
          return `${open}${body}\n        ndk {\n            abiFilters "arm64-v8a"\n        }${close}`;
        }
      );

      fs.writeFileSync(buildGradlePath, contents, 'utf8');
      console.log('[withAndroidABIFilter] Patched build.gradle with abiFilters arm64-v8a');
      return config;
    },
  ]);
};

module.exports = withAndroidABIFilter;

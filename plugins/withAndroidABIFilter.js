/* eslint-disable */
/**
 * withAndroidABIFilter.js — v279
 *
 * 仅保留 arm64-v8a（64位真机），彻底移除 x86 / x86_64 / armeabi-v7a。
 *
 * 方案：同时使用两种互补机制，任意一种生效即可确保过滤：
 *
 * ① withGradleProperties — 写入 gradle.properties:
 *      reactNativeArchitectures=arm64-v8a
 *    React Native Gradle 插件会读取此属性并限制 JNI 编译架构。
 *    这是 RN 官方推荐方式，兼容性最好，不受 build.gradle 内容影响。
 *
 * ② withDangerousMod — 写入 android/app/build.gradle defaultConfig:
 *      ndk { abiFilters "arm64-v8a" }
 *    兜底保障，确保 APK 打包阶段也过滤。
 *
 * 两种机制均含幂等保护，可重复运行。
 */

const { withGradleProperties, withDangerousMod } = require('expo/config-plugins');
const path = require('path');
const fs = require('fs');

// ── ① gradle.properties: reactNativeArchitectures ───────────────────────────
const withReactNativeArchitectures = (config) => {
  return withGradleProperties(config, (config) => {
    const props = config.modResults;

    // 移除旧的同名属性（可能有多个）
    const filtered = props.filter(
      (item) => !(item.type === 'property' && item.key === 'reactNativeArchitectures')
    );
    // 追加新值
    filtered.push({
      type: 'property',
      key: 'reactNativeArchitectures',
      value: 'arm64-v8a',
    });

    config.modResults = filtered;
    console.log('[withAndroidABIFilter] Set reactNativeArchitectures=arm64-v8a in gradle.properties');
    return config;
  });
};

// ── ② build.gradle: ndk { abiFilters } ─────────────────────────────────────
const NDK_MARKER = '// @abi-filter-v279';

const withBuildGradleABIFilter = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const buildGradlePath = path.join(
        config.modRequest.projectRoot,
        'android/app/build.gradle'
      );

      if (!fs.existsSync(buildGradlePath)) {
        console.warn('[withAndroidABIFilter] build.gradle not found, skipping');
        return config;
      }

      let contents = fs.readFileSync(buildGradlePath, 'utf8');

      // 幂等检查（版本标记）
      if (contents.includes(NDK_MARKER)) {
        console.log('[withAndroidABIFilter] build.gradle already patched (v279), skipping');
        return config;
      }

      // 清理旧版注入（无版本标记的旧 ndk block）
      contents = contents.replace(
        /\n\s*ndk\s*\{\s*\n\s*abiFilters[^\n]*\n\s*\}/g,
        ''
      );

      // 在 defaultConfig { } 结束前插入
      const patched = contents.replace(
        /(defaultConfig\s*\{)([\s\S]*?)(\n(\s*)\})/,
        (match, open, body, closeLine, indent) => {
          return `${open}${body}\n${indent}    ndk {\n${indent}        ${NDK_MARKER}\n${indent}        abiFilters "arm64-v8a"\n${indent}    }${closeLine}`;
        }
      );

      if (patched === contents) {
        console.warn('[withAndroidABIFilter] Could not find defaultConfig block in build.gradle');
        return config;
      }

      fs.writeFileSync(buildGradlePath, patched, 'utf8');
      console.log('[withAndroidABIFilter] Patched build.gradle defaultConfig with ndk abiFilters');
      return config;
    },
  ]);
};

// ── 组合两种机制 ──────────────────────────────────────────────────────────────
const withAndroidABIFilter = (config) => {
  config = withReactNativeArchitectures(config);
  config = withBuildGradleABIFilter(config);
  return config;
};

module.exports = withAndroidABIFilter;


/* eslint-disable */
/**
 * withAndroidSplashFix.js
 *
 * 修复 expo-splash-screen 在 Android 12+ 上把启动图当"图标"居中缩小显示的问题。
 *
 * 根本原因（两处）：
 * 1. withAndroidSplashDrawables.js 生成 ic_launcher_background.xml 时
 *    写死 android:gravity="center" → 图片居中而非铺满
 * 2. withAndroidSplashStyles.js 写入 windowSplashScreenAnimatedIcon
 *    + android:windowSplashScreenBehavior="icon_preferred"
 *    → Android 12 把整张图当 App Icon（最大 240dp）居中显示
 *
 * 本插件运行于 expo-splash-screen 之后，覆盖这两处生成结果：
 * A. 将 ic_launcher_background.xml 的 gravity 改为 fill
 * B. 将 values(-v31)/styles.xml 中的 Theme.App.SplashScreen 重写：
 *    - windowSplashScreenAnimatedIcon → @null（不显示图标，只显示背景）
 *    - 删除 icon_preferred 行为
 *    - android:windowBackground → @drawable/ic_launcher_background（全屏）
 */

const { withDangerousMod, withAndroidStyles } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

/** 将 drawable/ic_launcher_background.xml 的 gravity 改为 fill */
function patchDrawable(projectRoot) {
  const drawablePath = path.join(
    projectRoot,
    'android/app/src/main/res/drawable/ic_launcher_background.xml'
  );
  if (!fs.existsSync(drawablePath)) return;

  let xml = fs.readFileSync(drawablePath, 'utf8');
  // 把所有 gravity="center" 改成 gravity="fill"
  xml = xml.replace(/android:gravity="center"/g, 'android:gravity="fill"');
  // 同时确保 bitmap 的宽高铺满
  xml = xml.replace(
    /<bitmap\s/g,
    '<bitmap android:width="match_parent" android:height="match_parent" '
  );
  // 清理重复属性（如果已有 width/height）
  xml = xml.replace(
    /android:width="match_parent" android:height="match_parent" android:width="match_parent" android:height="match_parent"/g,
    'android:width="match_parent" android:height="match_parent"'
  );
  fs.writeFileSync(drawablePath, xml, 'utf8');
  console.log('[withAndroidSplashFix] Patched ic_launcher_background.xml → gravity=fill');
}

/** 重写 styles.xml 中的 Theme.App.SplashScreen 条目 */
function patchStylesXml(filePath) {
  if (!fs.existsSync(filePath)) return;

  let xml = fs.readFileSync(filePath, 'utf8');

  // 找到 Theme.App.SplashScreen style block 并重写其 item 列表
  // 用正则把整个 <style name="Theme.App.SplashScreen" ...>...</style> 替换
  const styleBlockRegex = /<style\s+name="Theme\.App\.SplashScreen"[^>]*>[\s\S]*?<\/style>/;
  const replacement = `<style name="Theme.App.SplashScreen" parent="Theme.SplashScreen">
        <!-- 启动页背景色（始终生效） -->
        <item name="windowSplashScreenBackground">@color/splashscreen_background</item>
        <!-- 不使用 icon 模式，改用全屏 windowBackground -->
        <item name="windowSplashScreenAnimatedIcon">@null</item>
        <!-- android:windowBackground 铺满全屏（gravity=fill 由 drawable 控制） -->
        <item name="android:windowBackground">@drawable/ic_launcher_background</item>
        <!-- 启动完成后切换回主题 -->
        <item name="postSplashScreenTheme">@style/AppTheme</item>
    </style>`;

  if (styleBlockRegex.test(xml)) {
    xml = xml.replace(styleBlockRegex, replacement);
    fs.writeFileSync(filePath, xml, 'utf8');
    console.log(`[withAndroidSplashFix] Patched ${path.basename(path.dirname(filePath))}/${path.basename(filePath)}`);
  }
}

const withAndroidSplashFix = (config) => {
  // 步骤 1：修复 drawable 的 gravity
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      patchDrawable(config.modRequest.projectRoot);
      return config;
    },
  ]);

  // 步骤 2：修复 styles.xml（values/ 和 values-v31/）
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const resDir = path.join(config.modRequest.projectRoot, 'android/app/src/main/res');
      [
        path.join(resDir, 'values/styles.xml'),
        path.join(resDir, 'values-v31/styles.xml'),
      ].forEach(patchStylesXml);
      return config;
    },
  ]);

  return config;
};

module.exports = withAndroidSplashFix;

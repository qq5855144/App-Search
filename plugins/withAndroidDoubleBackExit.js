/* eslint-disable */
/**
 * withAndroidDoubleBackExit.js
 *
 * 在 Android 原生层注册 OnBackPressedCallback，实现首页双击退出。
 *
 * 技术原理：
 * - React Native 0.83 (targetSdk 36) 改用 OnBackPressedDispatcher（而非 onBackPressed() 覆写）
 * - react-native-screens 在每个 Fragment attach 时注册自己的 OnBackPressedCallback
 * - 注册顺序（先→后）：RN mBackPressedCallback → 本插件 → react-native-screens Fragment callbacks
 * - LIFO 触发顺序（后→先）：react-native-screens callbacks（处理页面后退）→ 本插件（双击退出）→ RN
 *
 * 使用 withDangerousMod（直接操作文件系统），与 withAndroidSplashFix 同款模式，
 * 兼容性最好，不依赖构建系统的 mod provider 注册。
 */

const { withDangerousMod } = require('expo/config-plugins');
const path = require('path');
const fs = require('fs');

const withAndroidDoubleBackExit = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;

      // 动态查找 MainActivity.kt（支持任意 package name）
      const javaDir = path.join(projectRoot, 'android/app/src/main/java');
      let mainActivityPath = null;

      if (fs.existsSync(javaDir)) {
        // 递归查找 MainActivity.kt
        const find = (dir) => {
          for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            if (entry.isDirectory()) {
              const result = find(path.join(dir, entry.name));
              if (result) return result;
            } else if (entry.name === 'MainActivity.kt') {
              return path.join(dir, entry.name);
            }
          }
          return null;
        };
        mainActivityPath = find(javaDir);
      }

      if (!mainActivityPath) {
        console.warn('[withAndroidDoubleBackExit] MainActivity.kt not found, skipping');
        return config;
      }

      let contents = fs.readFileSync(mainActivityPath, 'utf8');

      // 幂等检查：已处理过则跳过
      if (contents.includes('backPressCount')) {
        console.log('[withAndroidDoubleBackExit] Already patched, skipping');
        return config;
      }

      // ── 1. 添加 import ────────────────────────────────────────────────────
      const importsToAdd = [
        'import android.os.Handler',
        'import android.os.Looper',
        'import android.widget.Toast',
        'import androidx.activity.OnBackPressedCallback',
      ];
      for (const imp of importsToAdd) {
        if (!contents.includes(imp)) {
          contents = contents.replace(/(^import .+$)/m, `$1\n${imp}`);
        }
      }

      // ── 2. 在 class body 添加字段 ─────────────────────────────────────────
      contents = contents.replace(
        /(class MainActivity[^{]*\{)/,
        `$1\n\n  private var backPressCount = 0\n  private val backPressHandler = Handler(Looper.getMainLooper())\n  private val resetBackPress = Runnable { backPressCount = 0 }`
      );

      // ── 3. 在 super.onCreate 后注册 OnBackPressedCallback ─────────────────
      contents = contents.replace(
        /(super\.onCreate\([^)]*\))/,
        `$1
    // 双击退出：仅在根页面（无可返回的 Fragment）触发，子页面交由系统导航处理
    onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
      override fun handleOnBackPressed() {
        if (supportFragmentManager.backStackEntryCount > 0) {
          // 子页面：暂时禁用本回调，让 react-native-screens 的 Fragment 回调处理导航
          isEnabled = false
          this@MainActivity.onBackPressedDispatcher.onBackPressed()
          isEnabled = true
        } else {
          // 根页面：双击退出逻辑
          this@MainActivity.backPressCount++
          if (this@MainActivity.backPressCount == 1) {
            Toast.makeText(this@MainActivity, "再按一次退出应用", Toast.LENGTH_SHORT).show()
            this@MainActivity.backPressHandler.postDelayed(this@MainActivity.resetBackPress, 2000)
          } else {
            this@MainActivity.backPressHandler.removeCallbacks(this@MainActivity.resetBackPress)
            this@MainActivity.backPressCount = 0
            this@MainActivity.finish()
          }
        }
      }
    })`
      );

      fs.writeFileSync(mainActivityPath, contents, 'utf8');
      console.log('[withAndroidDoubleBackExit] Patched', mainActivityPath);
      return config;
    },
  ]);
};

module.exports = withAndroidDoubleBackExit;

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

      // ── 3. 在 super.onCreate() 之前注册 OnBackPressedCallback ────────────
      //
      // 关键原理（LIFO 优先级）：
      //   OnBackPressedDispatcher 按 LIFO 触发：最后注册的最先触发。
      //   RN 的 mBackPressedCallback 在 super.onCreate() 内注册 → 比我们晚 → 优先级高。
      //   因此 RN 的回调先触发 → 把事件发给 JS BackHandler → React Navigation 处理导航。
      //   ① 子页面：JS navigation.goBack() 消费事件 → invokeDefaultOnBackPressed 不触发 → 我们的回调不触发 ✓
      //   ② 根页面：JS 无法返回 → invokeDefaultOnBackPressed → activity.onBackPressed()
      //             → dispatcher 再次触发 → RN 回调已禁用 → 我们的回调触发 ✓
      //
      // 若把 addCallback 放在 super.onCreate() 之后，我们的优先级反而高于 RN，
      // 导致子页面也被我们拦截（实为之前版本的 bug）。
      contents = contents.replace(
        /(super\.onCreate\([^)]*\))/,
        `onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
      override fun handleOnBackPressed() {
        // 执行到这里说明 JS 层（React Navigation）没有消费事件，即当前在根页面
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
    })
    $1`
      );

      fs.writeFileSync(mainActivityPath, contents, 'utf8');
      console.log('[withAndroidDoubleBackExit] Patched', mainActivityPath);
      return config;
    },
  ]);
};

module.exports = withAndroidDoubleBackExit;

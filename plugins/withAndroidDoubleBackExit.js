/* eslint-disable */
/**
 * withAndroidDoubleBackExit.js — v278
 *
 * 覆写 invokeDefaultOnBackPressed()，实现首页双击退出。
 *
 * 技术原理：
 *   React Native 的 back 事件链路：
 *     硬件返回键 → OnBackPressedDispatcher → RN mBackPressedCallback
 *     → JS BackHandler → React Navigation
 *     → 子页面：navigation.goBack()，invokeDefaultOnBackPressed 不调用
 *     → 根页面：JS 无法返回，调用 invokeDefaultOnBackPressed()
 *
 *   因此只需覆写 invokeDefaultOnBackPressed()，该方法天然只在根页面触发。
 *   无需 OnBackPressedCallback、无需判断 backStackEntryCount，逻辑最简洁。
 *
 * 幂等标记：'// @double-back-exit-v278'（版本号变化时需更新此标记以强制重新注入）
 */

const { withDangerousMod } = require('expo/config-plugins');
const path = require('path');
const fs = require('fs');

const PATCH_MARKER = '// @double-back-exit-v278';

const withAndroidDoubleBackExit = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;

      // 动态查找 MainActivity.kt
      const javaDir = path.join(projectRoot, 'android/app/src/main/java');
      let mainActivityPath = null;
      if (fs.existsSync(javaDir)) {
        const find = (dir) => {
          for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            if (entry.isDirectory()) {
              const r = find(path.join(dir, entry.name));
              if (r) return r;
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

      // 幂等检查（版本标记匹配才跳过；旧版标记不同 → 强制重新注入）
      if (contents.includes(PATCH_MARKER)) {
        console.log('[withAndroidDoubleBackExit] Already patched (v278), skipping');
        return config;
      }

      // ── 清理旧版注入（v276/v277 用 OnBackPressedCallback 方式）────────────
      // 移除旧的 class 字段
      contents = contents.replace(
        /\n\n  private var backPressCount[^\n]+\n  private val backPressHandler[^\n]+\n  private val resetBackPress[^\n]+/g,
        ''
      );
      // 移除旧的 addCallback 注入块（从 addCallback 到 }) 之间）
      contents = contents.replace(
        /\n?\s*onBackPressedDispatcher\.addCallback\([\s\S]*?\}\)\s*\n/g,
        '\n'
      );
      // 移除旧 import androidx.activity.OnBackPressedCallback
      contents = contents.replace(/\nimport androidx\.activity\.OnBackPressedCallback\n?/g, '\n');

      // ── 1. 添加 import ────────────────────────────────────────────────────
      const importsToAdd = [
        'import android.os.Handler',
        'import android.os.Looper',
        'import android.widget.Toast',
      ];
      for (const imp of importsToAdd) {
        if (!contents.includes(imp)) {
          contents = contents.replace(/(^import .+$)/m, `$1\n${imp}`);
        }
      }

      // ── 2. 在 class body 添加字段 ─────────────────────────────────────────
      if (!contents.includes('private var backPressCount')) {
        contents = contents.replace(
          /(class MainActivity[^{]*\{)/,
          `$1\n\n  private var backPressCount = 0\n  private val backPressHandler = Handler(Looper.getMainLooper())\n  private val resetBackPress = Runnable { backPressCount = 0 }`
        );
      }

      // ── 3. 覆写 invokeDefaultOnBackPressed() ─────────────────────────────
      //
      // invokeDefaultOnBackPressed() 是 ReactActivity 暴露的钩子，
      // 仅在 JS BackHandler 无法消费事件时（根页面）才被调用。
      // 子页面由 JS navigation.goBack() 消费，不会走到这里。
      //
      // 替换原有的 invokeDefaultOnBackPressed 方法体。
      const newMethod = `override fun invokeDefaultOnBackPressed() {
    ${PATCH_MARKER}
    backPressCount++
    if (backPressCount == 1) {
      Toast.makeText(this, "再按一次退出应用", Toast.LENGTH_SHORT).show()
      backPressHandler.postDelayed(resetBackPress, 2000)
    } else {
      backPressHandler.removeCallbacks(resetBackPress)
      backPressCount = 0
      finish()
    }
  }`;

      // 替换原有 invokeDefaultOnBackPressed 方法（多行匹配）
      if (contents.includes('override fun invokeDefaultOnBackPressed')) {
        contents = contents.replace(
          /override fun invokeDefaultOnBackPressed\(\)[\s\S]*?\n  \}/,
          newMethod
        );
      } else {
        // 若不存在则在 class 末尾追加（getMainComponentName 之前）
        contents = contents.replace(
          /(override fun getMainComponentName)/,
          `${newMethod}\n\n  $1`
        );
      }

      fs.writeFileSync(mainActivityPath, contents, 'utf8');
      console.log('[withAndroidDoubleBackExit] Patched (v278)', mainActivityPath);
      return config;
    },
  ]);
};

module.exports = withAndroidDoubleBackExit;

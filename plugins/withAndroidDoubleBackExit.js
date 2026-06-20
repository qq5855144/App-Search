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
 * 行为：
 * - 子页面（detail/下载/收藏等）：react-native-screens 消费事件，本插件不触发 ✓
 * - 首页（无可返回页面）：本插件触发 → 首次显示 Toast → 2s 内再次触发 → finish()
 */

const { withMainActivity } = require('expo/config-plugins');

const withAndroidDoubleBackExit = (config) => {
  return withMainActivity(config, (mod) => {
    let contents = mod.modResults.contents;

    // ── 1. 添加 import ──────────────────────────────────────────────────────
    const importBlock = [
      'import android.os.Handler',
      'import android.os.Looper',
      'import android.widget.Toast',
      'import androidx.activity.OnBackPressedCallback',
    ];
    for (const imp of importBlock) {
      if (!contents.includes(imp)) {
        // 在最后一个 import 行后插入
        contents = contents.replace(
          /(^import .+$)/m,
          `$1\n${imp}`
        );
      }
    }

    // ── 2. 在 class 体内添加字段（仅一次）─────────────────────────────────
    if (!contents.includes('backPressCount')) {
      // 匹配 class MainActivity ... { 后的第一个换行，插入字段
      contents = contents.replace(
        /(class MainActivity[^{]*\{)/,
        `$1

  private var backPressCount = 0
  private val backPressHandler = Handler(Looper.getMainLooper())
  private val resetBackPress = Runnable { backPressCount = 0 }`
      );
    }

    // ── 3. 在 super.onCreate(...) 之后注册 OnBackPressedCallback ───────────
    if (!contents.includes('onBackPressedDispatcher.addCallback')) {
      // 匹配 super.onCreate(null) 或 super.onCreate(savedInstanceState)
      contents = contents.replace(
        /(super\.onCreate\([^)]*\))/,
        `$1
    // 双击退出：LIFO 确保在 react-native-screens Fragment 回调之前，
    // 仅当无页面可后退时触发（子页面由 react-native-screens 自身消费）
    onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
      override fun handleOnBackPressed() {
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
    })`
      );
    }

    mod.modResults.contents = contents;
    return mod;
  });
};

module.exports = withAndroidDoubleBackExit;

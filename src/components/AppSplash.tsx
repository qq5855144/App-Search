import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Store } from 'lucide-react-native';

const TAGLINE = '发现精彩开源应用';

const isWeb = process.env.EXPO_OS === 'web';

export default function AppSplash() {
  const { width, height } = useWindowDimensions();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const dotsAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 图标淡入 + 弹性缩放
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: !isWeb,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: !isWeb,
      }),
    ]).start();

    // 加载点呼吸动画
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(dotsAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: !isWeb,
        }),
        Animated.timing(dotsAnim, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: !isWeb,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const dot1Opacity = dotsAnim.interpolate({
    inputRange: [0, 0.33, 0.66, 1],
    outputRange: [0.2, 1, 0.2, 0.2],
  });
  const dot2Opacity = dotsAnim.interpolate({
    inputRange: [0, 0.33, 0.66, 1],
    outputRange: [0.2, 0.2, 1, 0.2],
  });
  const dot3Opacity = dotsAnim.interpolate({
    inputRange: [0, 0.33, 0.66, 1],
    outputRange: [0.2, 0.2, 0.2, 1],
  });

  return (
    <View style={styles.container}>
      {/* 顶部装饰弧线 — 尺寸依赖运行时 width/height，用内联样式 */}
      <View style={[styles.arcTop, {
        top: -height * 0.25,
        left: -width * 0.3,
        width: width * 1.6,
        height: height * 0.55,
        borderBottomLeftRadius: width,
        borderBottomRightRadius: width,
      }]} />

      {/* 主内容 */}
      <Animated.View
        style={[
          styles.content,
          { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
        ]}
      >
        {/* 图标卡片 */}
        <View style={styles.iconCard}>
          <Store size={48} color="#1677FF" strokeWidth={1.5} />
        </View>

        {/* 应用名称 */}
        <Text style={styles.appName}>开源应用商店</Text>

        {/* 标语 */}
        <Text style={styles.tagline}>{TAGLINE}</Text>
      </Animated.View>

      {/* 底部加载指示器 */}
      <View style={styles.footer}>
        <View style={styles.dotsRow}>
          <Animated.View style={[styles.dot, { opacity: dot1Opacity }]} />
          <Animated.View style={[styles.dot, { opacity: dot2Opacity }]} />
          <Animated.View style={[styles.dot, { opacity: dot3Opacity }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F6F8',
  },
  arcTop: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
  },
  content: {
    alignItems: 'center',
    marginTop: -60,
  },
  iconCard: {
    width: 96,
    height: 96,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  icon: {
    width: 54,
    height: 54,
  },
  appName: {
    marginTop: 24,
    fontSize: 26,
    fontWeight: '700',
    color: '#1A1A1A',
    letterSpacing: 2,
  },
  tagline: {
    marginTop: 8,
    fontSize: 13,
    color: '#999999',
    letterSpacing: 3,
  },
  footer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 80 : 64,
    alignItems: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#1677FF',
  },
});
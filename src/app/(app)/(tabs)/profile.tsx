import { View, Text, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Keyboard, ActivityIndicator, Platform } from 'react-native';
import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Eye, EyeOff, ChevronRight } from 'lucide-react-native';
import { Ionicons } from '@expo/vector-icons';
import { saveToken, getToken, clearToken } from '@/lib/token';
import { getFavoriteStats } from '@/lib/database';
import { fetchRateLimit, setGitHubToken } from '@/lib/github';
import * as WebBrowser from 'expo-web-browser';

const S = {
  card: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 20,
    boxShadow: [{ offsetX: 0, offsetY: 1, blurRadius: 4, color: 'rgba(0,0,0,0.07)' }],
  } as any,
  divider: { height: 0.5, backgroundColor: '#F0F0F0' } as any,
};

export default function ProfileTab() {
  const router = useRouter();
  const [token, setTokenState] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [rateLimit, setRateLimit] = useState({ remaining: 60, limit: 60 });
  const [favCount, setFavCount] = useState(0);

  // 带超时的限速查询，避免长时挂起
  const refreshRateLimit = useCallback(() => {
    Promise.race<{ remaining: number; limit: number }>([
      fetchRateLimit(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000)),
    ])
      .then((l) => setRateLimit(l))
      .catch(() => {});
  }, []);

  const loadData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [t, stats] = await Promise.all([getToken(), getFavoriteStats()]);
      if (t) { setTokenState(t); setSaved(true); }
      setFavCount(stats.total);
      refreshRateLimit();
    } catch { /* ignore */ } finally {
      setLoadingData(false);
    }
  }, [refreshRateLimit]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const handleSave = async () => {
    const t = token.trim();
    if (t.length < 10 || saving) return;
    Keyboard.dismiss();
    setSaving(true);
    setSaveSuccess(false);
    // 立即更新内存中的 token，保证 API 调用立即生效
    await setGitHubToken(t);
    setSaved(true);
    try {
      await saveToken(t); // 持久化到 SecureStore（Web 可能受限）
    } catch (e) {
      console.warn('Token 持久化失败（仅影响下次启动）', e);
    }
    setSaveSuccess(true);
    setSaving(false);
    setTimeout(() => setSaveSuccess(false), 3000);
    refreshRateLimit();
  };

  const handleClear = async () => {
    await clearToken();
    setTokenState('');
    setSaved(false);
    setSaveSuccess(false);
    setRateLimit({ remaining: 60, limit: 60 });
  };

  const isConnected = saved && token.length > 0;
  const ratePct = rateLimit.limit > 0 ? rateLimit.remaining / rateLimit.limit : 0;
  const rateColor = ratePct > 0.4 ? '#52C41A' : ratePct > 0.15 ? '#FAAD14' : '#FF4D4F';

  const canSave = token.trim().length >= 10 && !saving;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F5F5' }} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        enabled={Platform.OS !== 'web'}
      >
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {/* ── 页面标题 ── */}
          <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
            <Text style={{ fontSize: 26, fontWeight: '700', color: '#1A1A1A' }}>我的</Text>
          </View>

          {/* ── GitHub 连接状态卡片 ── */}
          <View style={{ ...S.card, padding: 18 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              {/* 图标 */}
              <View style={{
                width: 56, height: 56, borderRadius: 28,
                backgroundColor: isConnected ? '#EBF3FF' : '#F5F5F5',
                alignItems: 'center', justifyContent: 'center',
                borderWidth: 2, borderColor: isConnected ? '#1677FF' : '#E0E0E0',
              }}>
                <Ionicons name="logo-github" size={28} color={isConnected ? '#1677FF' : '#AAAAAA'} />
              </View>

              {/* 文字 */}
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#1A1A1A' }}>
                  {isConnected ? '已连接 GitHub' : '未连接 GitHub'}
                </Text>
                <Text style={{ fontSize: 12, color: '#999999', marginTop: 2 }}>
                  {isConnected
                    ? `API 剩余配额 ${rateLimit.remaining} / ${rateLimit.limit} 次`
                    : '匿名限额：60 次/小时'}
                </Text>
              </View>

              {/* 状态徽标 */}
              <View style={{
                paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
                backgroundColor: isConnected ? '#F6FFED' : '#FFFBE6',
                borderWidth: 1, borderColor: isConnected ? '#52C41A' : '#FAAD14',
              }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: isConnected ? '#52C41A' : '#FAAD14' }}>
                  {isConnected ? '已认证' : '未认证'}
                </Text>
              </View>
            </View>

            {/* 限速进度条 */}
            {isConnected && !loadingData && (
              <View style={{ marginTop: 14 }}>
                <View style={{ height: 6, backgroundColor: '#EFEFEF', borderRadius: 6, overflow: 'hidden' }}>
                  <View style={{ height: 6, width: `${Math.round(ratePct * 100)}%` as any, backgroundColor: rateColor, borderRadius: 6 }} />
                </View>
                <Text style={{ fontSize: 11, color: '#AAAAAA', marginTop: 4, textAlign: 'right' }}>
                  剩余 {Math.round(ratePct * 100)}%
                </Text>
              </View>
            )}
          </View>

          {/* ── GitHub Token 配置卡片 ── */}
          <View style={{ ...S.card, padding: 18 }}>
            {/* 卡片标题行 */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="key" size={16} color="#1677FF" />
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#1A1A1A' }}>GitHub Token</Text>
              </View>
              <Pressable onPress={() => WebBrowser.openBrowserAsync('https://github.com/settings/tokens/new?description=OpenAppStore&scopes=public_repo')}>
                <Text style={{ fontSize: 12, color: '#1677FF' }}>如何获取 →</Text>
              </Pressable>
            </View>

            {/* 输入框：固定 height:42 与搜索框一致，防止聚焦时被 outline/border 撑高 */}
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              backgroundColor: '#F7F8FA', borderRadius: 12,
              paddingHorizontal: 12,
              height: 42,
              marginBottom: 14,
              borderWidth: 1.5,
              borderColor: token.trim().length > 0 ? '#1677FF' : 'transparent',
            }}>
              <Ionicons name="key-outline" size={17} color="#AAAAAA" />
              <TextInput
                key={showToken ? 'token-visible' : 'token-hidden'}
                style={{
                  flex: 1,
                  marginLeft: 10,
                  fontSize: 15,
                  lineHeight: 20,
                  color: '#1A1A1A',
                  // Web：消除聚焦时的 outline / border，防止撑高容器
                  outlineWidth: 0,
                  outlineStyle: 'none',
                  borderWidth: 0,
                } as any}
                placeholder="粘贴 GitHub Personal Access Token"
                placeholderTextColor="#BBBBBB"
                value={token}
                onChangeText={setTokenState}
                secureTextEntry={!showToken}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleSave}
              />
              <Pressable onPress={() => setShowToken((v) => !v)} style={{ padding: 4 }}>
                {showToken
                  ? <EyeOff size={18} color="#AAAAAA" />
                  : <Eye size={18} color="#AAAAAA" />
                }
              </Pressable>
            </View>

            {/* 提示文字 */}
            <Text style={{ fontSize: 11, color: '#BBBBBB', marginBottom: 14, lineHeight: 16 }}>
              Token 仅存储在本设备，提高 API 限额至 5000 次/小时
            </Text>

            {/* 保存按钮 */}
            <Pressable
              onPress={handleSave}
              disabled={!canSave}
              style={{
                borderRadius: 30, paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
                flexDirection: 'row', gap: 8,
                backgroundColor: saveSuccess ? '#52C41A' : !canSave ? '#C8DCFF' : '#1677FF',
              }}
            >
              {saving && <ActivityIndicator size="small" color="#FFFFFF" />}
              <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700' }}>
                {saveSuccess ? '✓ 已连接 GitHub' : saving ? '连接中...' : '保存 Token'}
              </Text>
            </Pressable>

            {/* 清除 */}
            {saved && !saving && (
              <Pressable onPress={handleClear} style={{ alignItems: 'center', marginTop: 12 }}>
                <Text style={{ color: '#FF4D4F', fontSize: 13 }}>清除已保存的 Token</Text>
              </Pressable>
            )}
          </View>

          {/* ── 快捷功能卡片 ── */}
          <View style={{ ...S.card, overflow: 'hidden', paddingVertical: 0 }}>
            {[
              {
                icon: 'heart' as const,
                iconBg: '#FFF0F6',
                iconColor: '#EB2F96',
                label: '我的收藏',
                sub: loadingData ? '加载中...' : `${favCount} 个应用`,
                onPress: () => router.push('/(app)/favorites' as any),
              },
              {
                icon: 'cloud-download-outline' as const,
                iconBg: '#EBF3FF',
                iconColor: '#1677FF',
                label: '下载中心',
                sub: '查看下载队列与安装包',
                onPress: () => router.push('/(app)/downloads' as any),
              },
              {
                icon: 'compass-outline' as const,
                iconBg: '#F0F8F0',
                iconColor: '#52C41A',
                label: '发现分类',
                sub: '按平台、语言、主题浏览',
                onPress: () => router.push('/(app)/(tabs)/discover' as any),
              },
            ].map((item, idx, arr) => (
              <View key={item.label}>
                <Pressable
                  onPress={item.onPress}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 15, gap: 12 }}
                >
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: item.iconBg, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={item.icon} size={20} color={item.iconColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#1A1A1A' }}>{item.label}</Text>
                    <Text style={{ fontSize: 12, color: '#999999', marginTop: 2 }}>{item.sub}</Text>
                  </View>
                  <ChevronRight size={17} color="#CCCCCC" />
                </Pressable>
                {idx < arr.length - 1 && <View style={{ ...S.divider, marginLeft: 68 }} />}
              </View>
            ))}
          </View>

          {/* 底部留白 */}
          <View style={{ height: 32 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}


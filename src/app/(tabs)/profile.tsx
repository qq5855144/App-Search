import React, { useCallback, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { saveToken, getToken, clearToken } from '@/lib/token';
import { getFavoriteStats } from '@/lib/database';
import { fetchRateLimit } from '@/lib/github';

export default function ProfileTab() {
  const [token, setTokenState] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [rateLimit, setRateLimit] = useState({ remaining: 60, limit: 60 });
  const [favCount, setFavCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [t, stats] = await Promise.all([getToken(), getFavoriteStats()]);
      if (t) { setTokenState(t); setSaved(true); }
      setFavCount(stats.total);
      fetchRateLimit().then(setRateLimit).catch(() => {});
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const handleSave = async () => {
    const t = token.trim();
    if (t.length < 10 || saving) return;
    setSaving(true);
    try {
      await saveToken(t);
      setSaved(true);
      fetchRateLimit().then(setRateLimit).catch(() => {});
    } catch { /* ignore */ } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    await clearToken();
    setTokenState('');
    setSaved(false);
    setRateLimit({ remaining: 60, limit: 60 });
  };

  const ratePct = rateLimit.limit > 0 ? rateLimit.remaining / rateLimit.limit : 0;
  const rateColor = ratePct > 0.5 ? '#52c41a' : ratePct > 0.2 ? '#faad14' : '#f5222d';

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F6F8', alignItems: 'center', justifyContent: 'center' }} edges={['top']}>
        <ActivityIndicator color="#1677FF" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F6F8' }} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 }}>
          <Text style={{ fontSize: 22, fontWeight: '700', color: '#1A1A1A' }}>我的</Text>
        </View>

        {/* 统计卡片 */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 16, gap: 12, marginBottom: 16 }}>
          {[
            { label: '收藏应用', value: String(favCount), icon: 'heart-outline' as const, color: '#FF4D88' },
            { label: 'API 剩余', value: `${rateLimit.remaining}/${rateLimit.limit}`, icon: 'flash-outline' as const, color: rateColor },
          ].map((item) => (
            <View key={item.label} style={{ flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 8, alignItems: 'center' }}>
              <Ionicons name={item.icon} size={24} color={item.color} />
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#1A1A1A' }}>{item.value}</Text>
              <Text style={{ fontSize: 12, color: '#888' }}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* Token 设置 */}
        <View style={{ marginHorizontal: 16, backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <Ionicons name="key-outline" size={18} color="#1677FF" />
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#1A1A1A' }}>GitHub Token</Text>
            {saved && <View style={{ marginLeft: 4, backgroundColor: '#F6FFED', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: '#B7EB8F' }}><Text style={{ fontSize: 11, color: '#52C41A' }}>已配置</Text></View>}
          </View>
          <Text style={{ fontSize: 13, color: '#888', marginBottom: 12, lineHeight: 18 }}>
            配置 Personal Access Token 可将 API 请求上限从每小时 60 次提升至 5000 次
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F7F7F7', borderRadius: 10, paddingHorizontal: 12, height: 44, marginBottom: 12 }}>
            <TextInput
              style={{ flex: 1, fontSize: 14, color: '#1A1A1A' } as any}
              value={token}
              onChangeText={setTokenState}
              placeholder="github_pat_..."
              placeholderTextColor="#BBB"
              secureTextEntry={!showToken}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable onPress={() => setShowToken((v) => !v)} hitSlop={8}>
              <Ionicons name={showToken ? 'eye-off-outline' : 'eye-outline'} size={18} color="#AAA" />
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable
              onPress={handleSave}
              disabled={token.trim().length < 10 || saving}
              style={{ flex: 1, height: 42, borderRadius: 10, backgroundColor: token.trim().length >= 10 ? '#1677FF' : '#E0E0E0', alignItems: 'center', justifyContent: 'center' }}
            >
              {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontWeight: '600' }}>保存 Token</Text>}
            </Pressable>
            {saved && (
              <Pressable onPress={handleClear} style={{ height: 42, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: '#FFB3B3', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#f5222d', fontSize: 14 }}>清除</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* 关于 */}
        <View style={{ marginHorizontal: 16, backgroundColor: '#fff', borderRadius: 16, padding: 16 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#1A1A1A', marginBottom: 12 }}>关于</Text>
          {[
            { label: '应用版本', value: '1.0.0' },
            { label: '数据来源', value: 'GitHub API' },
            { label: '运行平台', value: Platform.OS },
          ].map((item, i, arr) => (
            <React.Fragment key={item.label}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 }}>
                <Text style={{ color: '#555', fontSize: 14 }}>{item.label}</Text>
                <Text style={{ color: '#1A1A1A', fontSize: 14, fontWeight: '500' }}>{item.value}</Text>
              </View>
              {i < arr.length - 1 && <View style={{ height: 0.5, backgroundColor: '#F0F0F0' }} />}
            </React.Fragment>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

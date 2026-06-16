import React, { useCallback, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, Linking, Platform } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { saveToken, getToken, clearToken } from '@/lib/token';
import {
  getFavoriteStats,
  getDownloadHistory,
  getSearchHistory,
  clearDownloadHistory,
  clearSearchHistory,
} from '@/lib/database';
import { fetchRateLimit } from '@/lib/github';

type ConfirmTarget = 'downloads' | 'search' | 'token' | null;

export default function ProfileTab() {
  const router = useRouter();

  const [token, setTokenState] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget>(null);

  const [favCount, setFavCount] = useState(0);
  const [dlCount, setDlCount] = useState(0);
  const [histCount, setHistCount] = useState(0);
  const [rateLimit, setRateLimit] = useState({ remaining: 60, limit: 60, reset: 0 });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [t, stats, dl, hist] = await Promise.all([
        getToken(),
        getFavoriteStats(),
        getDownloadHistory(),
        getSearchHistory(),
      ]);
      if (t) { setTokenState(t); setSaved(true); }
      setFavCount(stats.total);
      setDlCount(dl.length);
      setHistCount(hist.length);
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

  /** 执行确认后的操作 */
  const handleConfirm = async () => {
    const target = confirmTarget;
    setConfirmTarget(null);
    if (target === 'downloads') {
      await clearDownloadHistory();
      setDlCount(0);
    } else if (target === 'search') {
      await clearSearchHistory();
      setHistCount(0);
    } else if (target === 'token') {
      await clearToken();
      setTokenState('');
      setSaved(false);
      setRateLimit({ remaining: 60, limit: 60, reset: 0 });
    }
  };

  const ratePct = rateLimit.limit > 0 ? rateLimit.remaining / rateLimit.limit : 0;
  const rateColor = ratePct > 0.5 ? '#52c41a' : ratePct > 0.2 ? '#faad14' : '#f5222d';
  const resetTime = rateLimit.reset
    ? new Date(rateLimit.reset * 1000).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    : '--:--';

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F6F8', alignItems: 'center', justifyContent: 'center' }} edges={['top']}>
        <ActivityIndicator color="#1677FF" />
      </SafeAreaView>
    );
  }

  const SectionTitle = ({ title }: { title: string }) => (
    <Text style={{ fontSize: 13, fontWeight: '600', color: '#999', marginHorizontal: 16, marginBottom: 8, marginTop: 4 }}>
      {title}
    </Text>
  );

  const Divider = () => <View style={{ height: 0.5, backgroundColor: '#F0F0F0', marginHorizontal: 16 }} />;

  const Row = ({
    icon, iconColor, label, value, onPress, danger, trailingIcon,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    iconColor: string;
    label: string;
    value?: string;
    onPress?: () => void;
    danger?: boolean;
    trailingIcon?: keyof typeof Ionicons.glyphMap;
  }) => (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      cssInterop={false}
      style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#fff' }}
      android_ripple={{ color: '#F0F0F0' }}
    >
      <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: `${iconColor}18`, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <Text style={{ flex: 1, fontSize: 15, color: danger ? '#f5222d' : '#1A1A1A' }}>{label}</Text>
      {value !== undefined && <Text style={{ fontSize: 14, color: '#999', marginRight: 4 }}>{value}</Text>}
      {onPress && <Ionicons name={trailingIcon || 'chevron-forward'} size={16} color="#CCC" />}
    </Pressable>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F6F8' }} edges={['top']}>
      {/* 跨端内联确认弹窗 */}
      {confirmTarget && (
        <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 100, alignItems: 'center', justifyContent: 'center' } as any}>
          <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 24, width: 280, gap: 12 }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: '#1A1A1A', textAlign: 'center' }}>确认清空</Text>
            <Text style={{ fontSize: 14, color: '#666', textAlign: 'center' }}>
              {confirmTarget === 'downloads' ? '将清空所有下载记录（不删除本地文件）' :
               confirmTarget === 'search' ? '将清空全部搜索历史' :
               '将删除已保存的 GitHub Token'}
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              <Pressable onPress={() => setConfirmTarget(null)}
                style={{ flex: 1, height: 42, borderRadius: 10, borderWidth: 1, borderColor: '#E0E0E0', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#666', fontWeight: '500' }}>取消</Text>
              </Pressable>
              <Pressable onPress={handleConfirm}
                style={{ flex: 1, height: 42, borderRadius: 10, backgroundColor: '#f5222d', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#fff', fontWeight: '600' }}>确认清空</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 }}>
          <Text style={{ fontSize: 22, fontWeight: '700', color: '#1A1A1A' }}>我的</Text>
        </View>

        {/* 统计卡片 4 格 */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 10, marginBottom: 20 }}>
          {[
            { label: '收藏应用', value: String(favCount),   icon: 'heart'       as const, color: '#FF4D88', route: '/favorites'      },
            { label: '下载记录', value: String(dlCount),    icon: 'download'    as const, color: '#1677FF', route: '/downloads'      },
            { label: '搜索历史', value: String(histCount),  icon: 'time'        as const, color: '#FF8C00', route: '/search-history' },
            { label: 'API 配额', value: `${rateLimit.remaining}/${rateLimit.limit}`, icon: 'flash' as const, color: rateColor, route: null },
          ].map((item) => (
            <Pressable
              key={item.label}
              onPress={() => item.route ? router.push(item.route as any) : undefined}
              android_ripple={{ color: '#F0F0F0' }}
              style={{
                width: '47.5%', backgroundColor: '#fff', borderRadius: 16, padding: 16,
                alignItems: 'center', gap: 6,
                boxShadow: [{ offsetX: 0, offsetY: 1, blurRadius: 4, color: 'rgba(0,0,0,0.06)' }],
              } as any}
            >
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: `${item.color}18`, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={item.icon} size={20} color={item.color} />
              </View>
              <Text style={{ fontSize: 20, fontWeight: '700', color: '#1A1A1A' }}>{item.value}</Text>
              <Text style={{ fontSize: 12, color: '#888' }}>{item.label}</Text>
              {item.label === 'API 配额' && (
                <Text style={{ fontSize: 10, color: '#BBB' }}>重置 {resetTime}</Text>
              )}
            </Pressable>
          ))}
        </View>

        {/* 功能入口 */}
        <SectionTitle title="功能" />
        <View style={{ marginHorizontal: 16, backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', marginBottom: 16 }}>
          <Row icon="heart-outline" iconColor="#FF4D88" label="我的收藏" value={`${favCount} 个`}
            onPress={() => router.push('/favorites' as any)} />
          <Divider />
          <Row icon="download-outline" iconColor="#1677FF" label="下载记录" value={`${dlCount} 条`}
            onPress={() => router.push('/downloads' as any)} />
          {dlCount > 0 && (
            <>
              <Divider />
              <Row icon="trash-outline" iconColor="#f5222d" label="清空下载记录" danger
                onPress={() => setConfirmTarget('downloads')} trailingIcon="trash-outline" />
            </>
          )}
          <Divider />
          <Row icon="time-outline" iconColor="#FF8C00" label="搜索历史" value={`${histCount} 条`}
            onPress={() => router.push('/search-history' as any)} />
          {histCount > 0 && (
            <>
              <Divider />
              <Row icon="trash-outline" iconColor="#f5222d" label="清空搜索历史" danger
                onPress={() => setConfirmTarget('search')} trailingIcon="trash-outline" />
            </>
          )}
        </View>

        {/* Token 管理 */}
        <SectionTitle title="GitHub Token" />
        <View style={{ marginHorizontal: 16, backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Ionicons name="key-outline" size={18} color="#1677FF" />
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#1A1A1A', flex: 1 }}>Personal Access Token</Text>
            {saved && (
              <View style={{ backgroundColor: '#F6FFED', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: '#B7EB8F' }}>
                <Text style={{ fontSize: 11, color: '#52C41A' }}>已配置</Text>
              </View>
            )}
          </View>
          <Text style={{ fontSize: 12, color: '#999', marginBottom: 12 }}>
            配置后 API 请求上限从 60→5000 次/小时
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
              {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontWeight: '600' }}>保存</Text>}
            </Pressable>
            <Pressable
              onPress={() => Linking.openURL('https://github.com/settings/tokens/new')}
              style={{ height: 42, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: '#D0D0D0', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 }}
            >
              <Ionicons name="open-outline" size={14} color="#555" />
              <Text style={{ color: '#555', fontSize: 13 }}>创建</Text>
            </Pressable>
            {saved && (
              <Pressable onPress={() => setConfirmTarget('token')}
                style={{ height: 42, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: '#FFB3B3', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#f5222d', fontSize: 13 }}>清除</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* 关于 */}
        <SectionTitle title="关于" />
        <View style={{ marginHorizontal: 16, backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', marginBottom: 16 }}>
          {([
            { label: '应用版本', value: '1.0.0', onPress: undefined },
            { label: '数据来源', value: 'GitHub API', onPress: undefined },
            { label: '运行平台', value: Platform.OS, onPress: undefined },
            { label: '项目仓库', value: 'GitHub', onPress: () => Linking.openURL('https://github.com/qq5855144/App-Search') },
          ] as const).map((item, i, arr) => (
            <React.Fragment key={item.label}>
              <Pressable
                onPress={item.onPress}
                disabled={!item.onPress}
                android_ripple={{ color: '#F0F0F0' }}
                style={{
                  flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                  paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#fff',
                }}
              >
                <Text style={{ color: '#555', fontSize: 14 }}>{item.label}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={{ color: '#1A1A1A', fontSize: 14, fontWeight: '500' }}>{item.value}</Text>
                  {item.onPress && <Ionicons name="open-outline" size={14} color="#AAA" />}
                </View>
              </Pressable>
              {i < arr.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}


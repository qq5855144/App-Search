/**
 * 全局排行榜页
 * 数据来自 Supabase app_rankings 表（由 aggregate-rankings Edge Function 聚合）
 * 支持：热门榜 / 下载榜 / 收藏榜 / 搜索热词  ×  周榜 / 月榜 / 总榜
 */
import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, FlatList, ActivityIndicator, ScrollView } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { supabase } from '@/client/supabase';
import { uploadPendingEvents } from '@/lib/events';
import LetterAvatar from '@/components/openappstore/LetterAvatar';

type RankType = 'hot' | 'download' | 'favorite' | 'keywords';
type Period = 'week' | 'month' | 'all';

interface RankItem {
  app_id: number;
  app_name: string;
  owner: string;
  repo: string;
  avatar_url: string;
  score: number;
  download_count: number;
  favorite_count: number;
  view_count: number;
  rank_position: number;
}

interface HotWord {
  keyword: string;
  count: number;
}

const RANK_TABS: { key: RankType; label: string; icon: string; color: string }[] = [
  { key: 'hot',      label: '热门榜',  icon: 'flame',    color: '#FF4D4F' },
  { key: 'download', label: '下载榜',  icon: 'download', color: '#1677FF' },
  { key: 'favorite', label: '收藏榜',  icon: 'heart',    color: '#FF4D88' },
  { key: 'keywords', label: '搜索热词', icon: 'search',  color: '#7C3AED' },
];

const PERIOD_TABS: { key: Period; label: string }[] = [
  { key: 'week',  label: '周榜' },
  { key: 'month', label: '月榜' },
  { key: 'all',   label: '总榜' },
];

const MEDAL_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];

export default function RankingScreen() {
  const router = useRouter();
  const [rankType, setRankType] = useState<RankType>('hot');
  const [period, setPeriod] = useState<Period>('week');
  const [items, setItems] = useState<RankItem[]>([]);
  const [hotWords, setHotWords] = useState<HotWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('');

  const loadRankings = useCallback(async (type: RankType, p: Period) => {
    setLoading(true);
    try {
      if (type === 'keywords') {
        const { data } = await supabase
          .from('search_hot_words')
          .select('keyword, count')
          .order('count', { ascending: false })
          .limit(50);
        setHotWords(Array.isArray(data) ? (data as HotWord[]) : []);
        setItems([]);
      } else {
        const { data, error } = await supabase
          .from('app_rankings')
          .select('app_id, app_name, owner, repo, avatar_url, score, download_count, favorite_count, view_count, rank_position, updated_at')
          .eq('rank_type', type)
          .eq('period', p)
          .order('rank_position', { ascending: true })
          .limit(50);
        if (error) throw error;
        // 过滤掉 app_id=0 或名称/owner 均为空的无效记录
        const valid = Array.isArray(data) ? data.filter((r: any) => r.app_id > 0 || r.app_name || r.owner) : [];
        setItems(valid);
        setHotWords([]);
        if (data && data.length > 0) {
          const ts = new Date((data[0] as any).updated_at);
          setLastUpdated(`更新于 ${ts.toLocaleDateString('zh-CN')} ${ts.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`);
        }
      }
    } catch {
      setItems([]);
      setHotWords([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      // 上报本地事件，然后无论是否有新事件都自动聚合一次，确保榜单始终最新
      uploadPendingEvents((name, opts) =>
        supabase.functions.invoke(name, { body: opts.body as Record<string, unknown> }).then(() => {})
      ).then(async () => {
        try { await supabase.functions.invoke('aggregate-rankings', {}); } catch { /* ignore */ }
        loadRankings(rankType, period);
      }).catch(() => { loadRankings(rankType, period); });
    }, [loadRankings, rankType, period])
  );

  const handleTabChange = (type: RankType) => {
    setRankType(type);
    loadRankings(type, period);
  };
  const handlePeriodChange = (p: Period) => {
    setPeriod(p);
    loadRankings(rankType, p);
  };

  const renderItem = ({ item, index }: { item: RankItem; index: number }) => {
    const rank = item.rank_position;
    const medal = rank <= 3 ? MEDAL_COLORS[rank - 1] : null;
    const hasValidIcon = !!(item.avatar_url || item.owner);
    const iconUri = item.avatar_url || (item.owner ? `https://github.com/${item.owner}.png` : '');
    const displayName = item.app_name || item.repo || `App #${item.app_id}`;
    const subLine = item.owner && item.repo ? `${item.owner}/${item.repo}` : item.owner || item.repo || '';
    return (
      <Pressable
        android_ripple={{ color: '#F0F0F0' }}
        onPress={() => item.owner && item.repo ? router.push(`/detail/${item.owner}/${item.repo}` as any) : undefined}
        style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: index < items.length - 1 ? 0.5 : 0, borderBottomColor: '#F0F0F0' }}
      >
        {/* 排名 */}
        <View style={{ width: 32, alignItems: 'center' }}>
          {medal
            ? <Ionicons name="trophy" size={20} color={medal} />
            : <Text style={{ fontSize: 15, fontWeight: '600', color: '#AAA' }}>{rank}</Text>}
        </View>

        {/* 图标：有有效 URL 则加载图片，否则字母头像 */}
        {hasValidIcon ? (
          <Image
            source={{ uri: iconUri }}
            style={{ width: 44, height: 44, borderRadius: 10, marginHorizontal: 12, backgroundColor: '#F5F5F5' }}
            contentFit="cover"
          />
        ) : (
          <View style={{ marginHorizontal: 12 }}>
            <LetterAvatar name={displayName} size={44} />
          </View>
        )}

        {/* 名称 + 统计 */}
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: '#1A1A1A' }} numberOfLines={1}>{displayName}</Text>
          {!!subLine && <Text style={{ fontSize: 12, color: '#888', marginTop: 2 }} numberOfLines={1}>{subLine}</Text>}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
            {item.download_count > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                <Ionicons name="download-outline" size={11} color="#1677FF" />
                <Text style={{ fontSize: 11, color: '#1677FF' }}>{item.download_count}</Text>
              </View>
            )}
            {item.favorite_count > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                <Ionicons name="heart-outline" size={11} color="#FF4D88" />
                <Text style={{ fontSize: 11, color: '#FF4D88' }}>{item.favorite_count}</Text>
              </View>
            )}
            {item.view_count > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                <Ionicons name="eye-outline" size={11} color="#888" />
                <Text style={{ fontSize: 11, color: '#888' }}>{item.view_count}</Text>
              </View>
            )}
          </View>
        </View>

        {/* 热度分 */}
        <Text style={{ fontSize: 13, fontWeight: '700', color: rankType === 'hot' ? '#FF4D4F' : rankType === 'download' ? '#1677FF' : '#FF4D88' }}>
          {item.score > 999 ? `${(item.score / 1000).toFixed(1)}k` : item.score}
        </Text>
      </Pressable>
    );
  };

  /** 搜索热词面板 */
  const renderKeywords = () => (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      {hotWords.length === 0 ? (
        <View style={{ alignItems: 'center', paddingTop: 60, gap: 10 }}>
          <Ionicons name="search-outline" size={48} color="#DDD" />
          <Text style={{ color: '#AAA', fontSize: 15 }}>暂无热搜数据</Text>
          <Text style={{ color: '#CCC', fontSize: 13, textAlign: 'center' }}>使用搜索功能后，热词将自动汇总显示</Text>
        </View>
      ) : (
        <>
          <View style={{ backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', marginBottom: 16 }}>
            {hotWords.slice(0, 10).map((w, i) => (
              <Pressable
                key={w.keyword}
                android_ripple={{ color: '#F0F0F0' }}
                onPress={() => router.push({ pathname: '/(tabs)/search', params: { q: w.keyword } } as any)}
                style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: i < 9 ? 0.5 : 0, borderBottomColor: '#F0F0F0' }}
              >
                <View style={{ width: 28, alignItems: 'center' }}>
                  {i < 3
                    ? <Ionicons name="flame" size={18} color={(['#FF4D4F', '#FF7A45', '#FFA940'] as const)[i]} />
                    : <Text style={{ fontSize: 14, color: '#BBB', fontWeight: '600' }}>{i + 1}</Text>}
                </View>
                <Text style={{ flex: 1, marginLeft: 10, fontSize: 15, color: '#1A1A1A', fontWeight: i < 3 ? '600' : '400' }}>{w.keyword}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <Text style={{ fontSize: 12, color: '#AAA' }}>{w.count} 次</Text>
                  <Ionicons name="chevron-forward" size={14} color="#CCC" />
                </View>
              </Pressable>
            ))}
          </View>
          {hotWords.length > 10 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {hotWords.slice(10).map((w) => (
                <Pressable
                  key={w.keyword}
                  onPress={() => router.push({ pathname: '/(tabs)/search', params: { q: w.keyword } } as any)}
                  style={{ paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#fff', borderRadius: 20, borderWidth: 0.5, borderColor: '#E8E8E8' }}
                >
                  <Text style={{ fontSize: 13, color: '#555' }}>{w.keyword}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F6F8' }} edges={['top']}>
      {/* 标题栏 */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
        <Text style={{ fontSize: 22, fontWeight: '700', color: '#1A1A1A' }}>排行榜</Text>
      </View>

      {/* 榜单类型 Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={{ flexShrink: 0, height: 56 }}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 8, alignItems: 'center' }}>
        {RANK_TABS.map((t) => (
          <Pressable
            key={t.key}
            onPress={() => handleTabChange(t.key)}
            android_ripple={{ color: '#F0F0F0' }}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 5,
              height: 40, paddingHorizontal: 16, borderRadius: 20,
              backgroundColor: rankType === t.key ? t.color : '#fff',
              ...(rankType !== t.key ? { boxShadow: [{ offsetX: 0, offsetY: 1, blurRadius: 3, color: 'rgba(0,0,0,0.06)' }] } : {}),
            } as any}
          >
            <Ionicons name={t.icon as any} size={14} color={rankType === t.key ? '#fff' : t.color} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: rankType === t.key ? '#fff' : '#555' }}>{t.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* 周期 Tabs（热词榜不需要） */}
      {rankType !== 'keywords' && (
        <View style={{ flexDirection: 'row', paddingHorizontal: 16, marginBottom: 8 }}>
          <View style={{ flexDirection: 'row', backgroundColor: '#EBEBEB', borderRadius: 20, padding: 3 }}>
            {PERIOD_TABS.map((t) => (
              <Pressable
                key={t.key}
                onPress={() => handlePeriodChange(t.key)}
                style={{ paddingHorizontal: 16, paddingVertical: 5, borderRadius: 16, backgroundColor: period === t.key ? '#fff' : 'transparent' }}
              >
                <Text style={{ fontSize: 13, fontWeight: period === t.key ? '600' : '400', color: period === t.key ? '#1A1A1A' : '#888' }}>{t.label}</Text>
              </Pressable>
            ))}
          </View>
          {lastUpdated ? (
            <Text style={{ fontSize: 11, color: '#BBB', alignSelf: 'center', marginLeft: 'auto' }}>{lastUpdated}</Text>
          ) : null}
        </View>
      )}

      {/* 内容区 */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#1677FF" size="large" />
        </View>
      ) : rankType === 'keywords' ? (
        renderKeywords()
      ) : items.length === 0 ? (
        <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 40 }}>
          <Ionicons name="trophy-outline" size={60} color="#E0E0E0" />
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#1A1A1A', marginTop: 16, textAlign: 'center' }}>
            全局榜单正在建立中
          </Text>
          <Text style={{ fontSize: 14, color: '#888', marginTop: 8, textAlign: 'center', lineHeight: 22 }}>
            榜单基于全体用户的真实行为生成，数据越多，榜单越准确。
          </Text>
          <View style={{ width: '100%', marginTop: 28, gap: 12 }}>
            {[
              { step: '1', icon: 'search-outline', color: '#1677FF', bg: '#EBF3FF', title: '搜索应用', desc: '在搜索页输入关键词，每次搜索都会计入统计' },
              { step: '2', icon: 'apps-outline',   color: '#FF8C00', bg: '#FFF7E6', title: '浏览 / 收藏 / 下载', desc: '进入详情页查看、点击收藏或下载安装包' },
              { step: '3', icon: 'sync-outline',   color: '#52C41A', bg: '#F6FFED', title: '自动更新', desc: '每次打开榜单页，系统自动聚合最新数据' },
            ].map((item) => (
              <View key={item.step} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14, backgroundColor: '#fff', borderRadius: 14, padding: 14, boxShadow: [{ offsetX: 0, offsetY: 1, blurRadius: 4, color: 'rgba(0,0,0,0.06)' }] } as any}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: item.bg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Ionicons name={item.icon as any} size={20} color={item.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: '#1677FF', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 10, color: '#fff', fontWeight: '700' }}>{item.step}</Text>
                    </View>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#1A1A1A' }}>{item.title}</Text>
                  </View>
                  <Text style={{ fontSize: 12, color: '#888', marginTop: 4, lineHeight: 18 }}>{item.desc}</Text>
                </View>
              </View>
            ))}
          </View>
          <Text style={{ fontSize: 11, color: '#CCC', marginTop: 20, textAlign: 'center' }}>
            榜单数据由所有用户共同贡献，匿名统计，不涉及个人隐私
          </Text>
        </ScrollView>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => String(i.app_id)}
          renderItem={renderItem}
          contentInsetAdjustmentBehavior="automatic"
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); loadRankings(rankType, period); }}
          style={{ marginHorizontal: 16, backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden' }}
          contentContainerStyle={{ paddingBottom: 32 }}
        />
      )}
    </SafeAreaView>
  );
}

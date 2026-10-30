import React, { useCallback, useState } from 'react'
import { View, Text, Pressable, FlatList, ActivityIndicator, ScrollView } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { useAndroidExitBack } from '@/hooks/useAndroidExitBack'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import AppIcon from '@/components/openappstore/AppIcon'
import { fetchPublicRankings, type PublicRankItem, type PublicRankType, type PublicRankPeriod } from '@/lib/publicRankings'

const RANK_TABS: { key: PublicRankType; label: string; icon: string; color: string }[] = [
  { key: 'trending', label: '趋势榜', icon: 'flame', color: '#FF4D4F' },
  { key: 'growth', label: 'Star 增长', icon: 'trending-up', color: '#1677FF' },
  { key: 'popular', label: '热门总榜', icon: 'star', color: '#E6A000' },
]
const PERIOD_TABS: { key: PublicRankPeriod; label: string }[] = [
  { key: 'week', label: '周榜' }, { key: 'month', label: '月榜' }, { key: 'all', label: '日榜' },
]
const MEDAL_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32']
const formatCount = (n: number) => n >= 1000000 ? `${(n / 1000000).toFixed(1)}m` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)

export default function RankingScreen() {
  useAndroidExitBack()
  const router = useRouter()
  const [rankType, setRankType] = useState<PublicRankType>('trending')
  const [period, setPeriod] = useState<PublicRankPeriod>('week')
  const [items, setItems] = useState<PublicRankItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState('')
  const [error, setError] = useState('')

  const loadRankings = useCallback(async (type: PublicRankType, p: PublicRankPeriod, force = false) => {
    setLoading(!force)
    setError('')
    try {
      const data = await fetchPublicRankings(type, p, force)
      setItems(data)
      setLastUpdated(new Date().toLocaleString('zh-CN', { hour12: false }))
    } catch (e: any) {
      setItems([])
      setError(e?.message || '公开榜单加载失败，请稍后重试')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useFocusEffect(useCallback(() => {
    void loadRankings(rankType, period)
  }, [loadRankings, rankType, period]))

  const handleTabChange = (type: PublicRankType) => {
    setRankType(type)
    void loadRankings(type, period)
  }
  const handlePeriodChange = (p: PublicRankPeriod) => {
    setPeriod(p)
    void loadRankings(rankType, p)
  }

  const renderItem = ({ item, index }: { item: PublicRankItem; index: number }) => {
    const medal = item.rank_position <= 3 ? MEDAL_COLORS[item.rank_position - 1] : null
    const metric = rankType === 'growth' ? item.score : item.stars
    return (
      <Pressable
        key={item.owner + '/' + item.repo}
        android_ripple={{ color: '#F5F5F5' }}
        onPress={() => router.push({ pathname: '/detail/[id]', params: { id: String(item.app_id || 0), owner: item.owner, repo: item.repo } } as any)}
        style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: index < items.length - 1 ? 0.5 : 0, borderBottomColor: '#F0F0F0', backgroundColor: '#fff' }}
      >
        <View style={{ width: 28, alignItems: 'center', marginRight: 8 }}>
          {medal ? <Ionicons name="trophy" size={18} color={medal} /> : <Text style={{ fontSize: 14, fontWeight: '700', color: '#CCC' }}>{item.rank_position}</Text>}
        </View>
        <View style={{ marginRight: 12 }}>
          <AppIcon owner={item.owner} url={item.avatar_url} name={item.app_name} size={44} priority={item.rank_position <= 5 ? 'high' : 'normal'} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: '#1A1A1A' }} numberOfLines={1}>{item.app_name}</Text>
          <Text style={{ fontSize: 11, color: '#AAA' }} numberOfLines={1}>{item.owner}/{item.repo}</Text>
          {!!item.description && <Text style={{ fontSize: 11, color: '#777' }} numberOfLines={1}>{item.description}</Text>}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {!!item.language && <Text style={{ fontSize: 10, color: '#999' }}>{item.language}</Text>}
            <Text style={{ fontSize: 10, color: '#999' }}>★ {formatCount(item.stars)}</Text>
            <Text style={{ fontSize: 10, color: '#999' }}>⑂ {formatCount(item.forks)}</Text>
          </View>
          <Text style={{ fontSize: 9, color: '#B0B4BC' }} numberOfLines={1}>
            {item.source} · {Number.isNaN(new Date(item.updated_at).getTime()) ? '时间未知' : new Date(item.updated_at).toLocaleDateString('zh-CN')}
          </Text>
        </View>
        <Text style={{ fontSize: 14, fontWeight: '700', color: rankType === 'growth' ? '#1677FF' : '#FF4D4F', marginLeft: 8 }}>
          {rankType === 'growth' ? `+${formatCount(metric)}` : formatCount(metric)}
        </Text>
      </Pressable>
    )
  }

  const subtitle = rankType === 'popular'
    ? '按 GitHub 当前 Star 总量排序 · 官方公开搜索数据'
    : rankType === 'growth'
      ? '按公开趋势快照中的周期 Star 增量排序'
      : 'GitHub Trending 公开快照 · 不使用本机行为数据'

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F6F8' }} edges={['top']}>
      <View style={{ backgroundColor: '#F5F6F8', paddingTop: 12, paddingBottom: 10 }}>
        <Text style={{ fontSize: 22, fontWeight: '700', color: '#1A1A1A', paddingHorizontal: 16, marginBottom: 6 }}>开源项目排行榜</Text>
        <Text style={{ fontSize: 11, color: '#999', paddingHorizontal: 16, marginBottom: 10 }}>{subtitle}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          {RANK_TABS.map(t => (
            <Pressable key={t.key} onPress={() => handleTabChange(t.key)} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: rankType === t.key ? t.color : '#fff', borderWidth: rankType === t.key ? 0 : 1, borderColor: '#E8E8E8' }}>
              <Ionicons name={t.icon as any} size={13} color={rankType === t.key ? '#fff' : t.color} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: rankType === t.key ? '#fff' : '#444' }}>{t.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginTop: 10 }}>
          <View style={{ flexDirection: 'row', backgroundColor: '#E8E8E8', borderRadius: 18, padding: 3 }}>
            {PERIOD_TABS.map(t => (
              <Pressable key={t.key} onPress={() => handlePeriodChange(t.key)} style={{ paddingHorizontal: 14, paddingVertical: 5, borderRadius: 14, backgroundColor: period === t.key ? '#fff' : 'transparent' }}>
                <Text style={{ fontSize: 13, fontWeight: period === t.key ? '700' : '400', color: period === t.key ? '#1A1A1A' : '#888' }}>{t.label}</Text>
              </Pressable>
            ))}
          </View>
          {!!lastUpdated && <Text style={{ fontSize: 10, color: '#BBB', marginLeft: 'auto' }}>获取于 {lastUpdated}</Text>}
        </View>
      </View>
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color="#1677FF" size="large" /></View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 }}>
          <Ionicons name="cloud-offline-outline" size={48} color="#C8CDD5" />
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#333', marginTop: 12 }}>公开榜单暂时无法加载</Text>
          <Text style={{ fontSize: 12, color: '#888', textAlign: 'center', marginTop: 8 }}>{error}</Text>
          <Pressable onPress={() => void loadRankings(rankType, period, true)} style={{ marginTop: 18, backgroundColor: '#1677FF', borderRadius: 18, paddingHorizontal: 22, paddingVertical: 9 }}>
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>重试</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ flex: 1, marginHorizontal: 16, marginBottom: 12, backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden' }}>
          <FlatList
            data={items}
            keyExtractor={item => `${item.owner}/${item.repo}`}
            renderItem={renderItem}
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); void loadRankings(rankType, period, true) }}
            contentContainerStyle={{ paddingBottom: 40 }}
            ListEmptyComponent={<Text style={{ textAlign: 'center', color: '#999', padding: 30 }}>当前周期暂无公开排名数据</Text>}
          />
        </View>
      )}
      <Text style={{ fontSize: 10, color: '#B0B4BC', textAlign: 'center', paddingBottom: 8, paddingHorizontal: 16 }}>
        趋势数据来自 GitStock / OSS Insight；热门总榜来自 GitHub。第三方快照可能有延迟或缺失。
      </Text>
    </SafeAreaView>
  )
}

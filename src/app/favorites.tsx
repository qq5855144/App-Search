import { View, Text, Pressable, FlatList } from 'react-native';
import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Trash2, Download, Share2 } from 'lucide-react-native';
import { Platform } from 'react-native';
import { getFavorites, getFavoriteGroups, removeFavorite } from '@/lib/database';
import AppIcon from '@/components/openappstore/AppIcon';
import PlatformTag from '@/components/openappstore/PlatformTag';
import EmptyState from '@/components/openappstore/EmptyState';

export default function FavoritesScreen() {
  const router = useRouter();
  const [favorites, setFavorites] = useState<any[]>([]);
  const [groups, setGroups] = useState<string[]>(['全部收藏']);
  const [selectedGroup, setSelectedGroup] = useState('全部收藏');
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    const g = await getFavoriteGroups();
    setGroups(g);
    const f = await getFavorites(selectedGroup === '全部收藏' ? undefined : selectedGroup);
    setFavorites(f);
  }, [selectedGroup]);

  // BUG 2 修复：useFocusEffect 只在屏幕获焦时触发，切换分组时屏幕已聚焦不会再触发
  // 用 useEffect 监听 selectedGroup 变化，保证切换分组立即刷新列表
  useEffect(() => { load(); }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleRemove = async (appId: number) => {
    await removeFavorite(appId);
    await load();
  };

  // BUG 6 修复：原生端用 expo-file-system + expo-sharing 导出 JSON
  // 原实现在非 Web 端只 console.log，无实际导出效果
  const handleExport = async () => {
    setExporting(true);
    try {
      const data = favorites.map((f) => ({
        name: f.app_name,
        url: `https://github.com/${f.owner}/${f.repo}`,
        added_at: f.added_at,
        tags: (() => { try { return JSON.parse(f.tags || '[]'); } catch { return []; } })(),
      }));
      const jsonStr = JSON.stringify(data, null, 2);
      const filename = `favorites_${new Date().toISOString().slice(0, 10)}.json`;

      if (typeof document !== 'undefined') {
        // Web 平台：创建下载链接
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
      } else {
        // 原生平台：动态导入 expo-file-system + expo-sharing（避免 web bundle 污染）
        const [FileSystem, Sharing] = await Promise.all([
          import('expo-file-system/legacy'),
          import('expo-sharing'),
        ]);
        const fileUri = (FileSystem.documentDirectory ?? '') + filename;
        await FileSystem.writeAsStringAsync(fileUri, jsonStr, { encoding: FileSystem.EncodingType.UTF8 });
        const available = await Sharing.isAvailableAsync();
        if (available) {
          await Sharing.shareAsync(fileUri, { mimeType: 'application/json', dialogTitle: '导出收藏列表' });
        }
      }
    } catch {
      // ignore
    } finally {
      setExporting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* 头部 */}
      <View className="flex-row items-center px-4 py-2">
        <Pressable onPress={() => router.back()} className="p-2">
          <ArrowLeft size={24} color="#1A1A1A" />
        </Pressable>
        <Text className="flex-1 text-center text-base font-semibold text-foreground pr-10">我的收藏</Text>
      </View>

      {/* 分组筛选 */}
      <View className="px-4 py-2">
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={groups}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setSelectedGroup(item)}
              className={`px-4 py-1.5 rounded-full mr-2 ${selectedGroup === item ? 'bg-primary' : 'bg-card border border-border'}`}
              cssInterop={false}
            >
              <Text className={`text-xs ${selectedGroup === item ? 'text-primary-foreground' : 'text-foreground'}`}>{item}</Text>
            </Pressable>
          )}
          keyExtractor={(item) => item}
        />
      </View>

      {/* 导出按钮 */}
      <View className="px-4 py-1 flex-row justify-end">
        <Pressable onPress={handleExport} className="flex-row items-center" cssInterop={false}>
          <Share2 size={14} color="#1677FF" />
          <Text className="text-xs text-primary ml-1">导出收藏</Text>
        </Pressable>
      </View>

      {/* 收藏列表 */}
      <FlatList
        data={favorites}
        renderItem={({ item }) => (
          <View className="mx-4 mb-3 p-4 rounded-2xl bg-card" style={{ boxShadow: [{ offsetX: 0, offsetY: 1, blurRadius: 3, color: 'rgba(0,0,0,0.08)' }] }}>
            <Pressable
              onPress={() => router.push({ pathname: `/detail/${item.app_id}`, params: { owner: item.owner, repo: item.repo } } as any)}
            >
              <View className="flex-row items-center">
                <AppIcon owner={item.owner} repo={item.repo} url={item.avatar_url} name={item.app_name} size={48} />
                <View className="flex-1 ml-3" style={{ gap: 2 }}>
                  <Text className="text-sm font-semibold text-foreground">{item.app_name}</Text>
                  <Text className="text-xs text-muted-foreground" numberOfLines={1}>{item.description}</Text>
                  <View className="flex-row flex-wrap" style={{ gap: 4 }}>
                    {(() => {
                      try {
                        const ps = JSON.parse(item.platforms || '[]') as string[];
                        return ps.slice(0, 2).map((p: string) => <PlatformTag key={p} platform={p} />);
                      } catch {
                        return null;
                      }
                    })()}
                  </View>
                </View>
                <View className="flex-row items-center" style={{ gap: 8 }}>
                  <Pressable
                    onPress={() => {
                      const url = `https://github.com/${item.owner}/${item.repo}/releases`;
                      import('expo-web-browser').then((m) => m.openBrowserAsync(url));
                    }}
                    className="flex-row items-center px-3 py-1 rounded-full border border-primary"
                    cssInterop={false}
                  >
                    <Download size={12} color="#1677FF" />
                    <Text className="text-xs text-primary ml-1">下载</Text>
                  </Pressable>
                  <Pressable onPress={() => handleRemove(item.app_id)} className="p-2">
                    <Trash2 size={16} color="#FF4D4F" />
                  </Pressable>
                </View>
              </View>
            </Pressable>
          </View>
        )}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<EmptyState title="暂无收藏应用" />}
        contentContainerClassName="pb-4"
      />
    </SafeAreaView>
  );
}

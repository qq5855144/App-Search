/**
 * Backend-free compatibility facade.
 * All data is fetched directly from GitHub or derived from local device storage.
 * No Supabase URL, key, database, or Edge Function is used.
 */
import type { AppItem } from '@/types'
import { smartSearch, searchRepos } from '@/lib/github'
import { getFavorites, getDownloadHistory, getSearchHistory } from '@/lib/database'
import { getAllEvents } from '@/lib/events'

type QueryState = { table: string; filters: Record<string, any>; max: number; sort: string; ascending: boolean }
async function localRows(state: QueryState): Promise<any[]> {
  if (state.table !== 'app_rankings') return []
  const kind = state.filters.rank_type || 'hot'
  const period = state.filters.period || 'all'
  const cutoff = period === 'week' ? Date.now() - 7 * 86400000 : period === 'month' ? Date.now() - 30 * 86400000 : 0
  const within = (value: any) => !cutoff || (value && new Date(value).getTime() >= cutoff)
  if (kind === 'favorite') {
    const rows = await getFavorites()
    return rows.filter((r:any) => within(r.added_at)).map((r:any,i:number)=>({app_id:r.app_id,app_name:r.app_name,owner:r.owner,repo:r.repo,avatar_url:r.avatar_url,score:1,download_count:0,favorite_count:1,view_count:0,rank_position:i+1,updated_at:r.added_at})).slice(0,state.max)
  }
  if (kind === 'download') {
    const rows = await getDownloadHistory()
    const counts = new Map<string, any>()
    for (const r of rows as any[]) {
      if (!within(r.download_time)) continue
      const key = r.owner+'/'+r.repo
      const value = counts.get(key) || {app_id:r.app_id,app_name:r.app_name,owner:r.owner,repo:r.repo,avatar_url:r.avatar_url,score:0,download_count:0,favorite_count:0,view_count:0}
      value.download_count++; value.score=value.download_count; counts.set(key,value)
    }
    return [...counts.values()].sort((x,y)=>y.score-x.score).slice(0,state.max).map((v,i)=>({...v,rank_position:i+1,updated_at:new Date().toISOString()}))
  }
  const events = await getAllEvents()
  const stats = new Map<string, any>()
  for (const event of events as any[]) {
    if (cutoff && event.created_at < cutoff) continue
    if (!event.owner || !event.repo || !['view','download','favorite'].includes(event.event_type)) continue
    const key = event.owner+'/'+event.repo
    const value = stats.get(key) || {app_id:event.app_id || 0,app_name:event.app_name || event.repo,owner:event.owner,repo:event.repo,avatar_url:event.avatar_url || '',score:0,download_count:0,favorite_count:0,view_count:0}
    if (event.event_type === 'view') value.view_count++
    if (event.event_type === 'download') value.download_count++
    if (event.event_type === 'favorite') value.favorite_count++
    value.score=value.download_count*5+value.view_count+value.favorite_count*3
    stats.set(key,value)
  }
  return [...stats.values()].sort((x,y)=>y.score-x.score).slice(0,state.max).map((v,i)=>({...v,rank_position:i+1,updated_at:new Date().toISOString()}))
}

function queryBuilder(table:string) {
  const state:QueryState={table,filters:{},max:50,sort:'rank_position',ascending:true}
  const q:any={select:()=>q,eq:(k:string,v:any)=>{state.filters[k]=v;return q},order:(k:string,o:any)=>{state.sort=k;state.ascending=!!o?.ascending;return q},limit:(n:number)=>{state.max=n;return q},then:(resolve:any,reject:any)=>localRows(state).then(data=>resolve({data,error:null}),reject)}
  return q
}
export const supabase = {
  auth: {
    getSession: async()=>({data:{session:null}}),
    onAuthStateChange: ()=>({data:{subscription:{unsubscribe(){}}}}),
    refreshSession: async()=>({error:null}),
    signOut: async()=>({error:null}),
  },
  functions: {
    invoke: async(name:string, options:any={}) => {
      if (name === 'search-catalog') {
        const b=options.body||{}
        const qualifiers=[b.platform && b.platform!=='全平台' ? 'topic:'+String(b.platform).toLowerCase() : '',b.language && b.language!=='全部' ? 'language:'+b.language : '',b.min_stars ? 'stars:>='+b.min_stars : '',...(Array.isArray(b.topics)&&b.topics.length ? ['('+b.topics.map((t:string)=>'topic:'+t).join(' OR ')+')'] : [])].filter(Boolean)
        const q=[String(b.q||'').trim(),...qualifiers].filter(Boolean).join(' ') || 'stars:>0'
        try { const r=await smartSearch(q,{sort:b.sort||'stars',page:b.page||1,per_page:b.per_page||20,hasInstallableAssets:b.has_installable_assets!==false}); return {data:{data:r.items,total_count:r.total_count},error:null} }
        catch(e:any){return {data:null,error:{message:e?.message||'GitHub 搜索失败'}}}
      }
      if (name === 'aggregate-rankings') return {data:{ok:true,local:true},error:null}
      return {data:null,error:{message:'此功能已切换为本地模式，不再调用后端服务'}}
    }
  },
  rpc: async(name:string, args:any={}) => {
    if(name==='get_hot_keywords'){const words=await getSearchHistory();return {data:words.slice(0,args.limit_n||20).map((keyword:string,i:number)=>({keyword,cnt:words.length-i})),error:null}}
    return {data:[],error:null}
  },
  from: (table:string)=>queryBuilder(table),
}

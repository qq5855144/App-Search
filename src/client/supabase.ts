/**
 * Backend-free compatibility facade.
 * All data is fetched directly from GitHub or derived from local device storage.
 * No Supabase URL, key, database, or Edge Function is used.
 */
import type { AppItem } from '@/types'
import { smartSearch, searchRepos } from '@/lib/github'
import { getFavorites, getDownloadHistory, getSearchHistory } from '@/lib/database'

type QueryState = { table: string; filters: Record<string, any>; max: number; sort: string; ascending: boolean }
function localRows(state: QueryState): Promise<any[]> {
  if (state.table === 'app_rankings') {
    const kind = state.filters.rank_type || 'hot'
    if (kind === 'favorite') return getFavorites().then(rows => rows.map((r:any,i:number)=>({app_id:r.app_id,app_name:r.app_name,owner:r.owner,repo:r.repo,avatar_url:r.avatar_url,score:1,download_count:0,favorite_count:1,view_count:0,rank_position:i+1,updated_at:r.added_at})).slice(0,state.max))
    if (kind === 'download') return getDownloadHistory().then(rows => {
      const counts = new Map<string, any>()
      for (const r of rows as any[]) { const k = r.owner+'/'+r.repo; const v=counts.get(k)||{app_id:r.app_id,app_name:r.app_name,owner:r.owner,repo:r.repo,avatar_url:r.avatar_url,score:0,download_count:0,favorite_count:0,view_count:0}; v.download_count++;v.score=v.download_count;counts.set(k,v) }
      return [...counts.values()].sort((a,b)=>b.score-a.score).slice(0,state.max).map((v,i)=>({...v,rank_position:i+1,updated_at:new Date().toISOString()}))
    })
    return searchRepos('stars:>100', {sort:'stars',page:1,per_page:Math.min(state.max,50),installableOnly:false}).then(r=>r.items.map((v,i)=>({app_id:v.id,app_name:v.name,owner:v.owner,repo:v.repo,avatar_url:v.avatar_url,score:v.stars,download_count:0,favorite_count:0,view_count:0,rank_position:i+1,updated_at:v.updated_at})))
  }
  return Promise.resolve([])
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
        const qualifiers=[b.platform && b.platform!=='全平台' ? 'topic:'+String(b.platform).toLowerCase() : '',b.language && b.language!=='全部' ? 'language:'+b.language : '',b.min_stars ? 'stars:>='+b.min_stars : '',(Array.isArray(b.topics)&&b.topics.length ? ['('+b.topics.map((t:string)=>'topic:'+t).join(' OR ')+')'] : [])].filter(Boolean)
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

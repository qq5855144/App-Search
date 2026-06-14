import { createClient } from '@supabase/supabase-js'

const supabaseUrl: string = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey: string = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,   // 无登录系统，禁用 session 持久化，避免 OPFS 冲突
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
})

const rawUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? ''

export const supabaseUrl = rawUrl.replace(/\/+$/, '')
export const supabaseAnonKey = rawKey
export const isSupabaseConfigured = Boolean(supabaseUrl && rawKey)

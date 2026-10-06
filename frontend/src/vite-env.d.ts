/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** `supabase` (padrão) ou `api` — design D1 da T-16. */
  readonly VITE_BACKEND?: string
  readonly VITE_API_URL?: string
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

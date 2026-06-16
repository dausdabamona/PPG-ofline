/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL project Supabase (server pusat daerah). */
  readonly VITE_SUPABASE_URL: string
  /** Kunci anon (public) Supabase. */
  readonly VITE_SUPABASE_ANON_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

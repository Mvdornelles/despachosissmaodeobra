import { createClient } from '@supabase/supabase-js'
import { env, logger } from './src/config/env'

/**
 * Cliente Supabase configurado com variáveis de ambiente validadas
 * 
 * Este cliente é configurado automaticamente com as credenciais
 * definidas nas variáveis de ambiente e validadas no módulo env.
 */
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
  auth: {
    // Configurações de autenticação
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  // Configurações globais
  global: {
    headers: {
      'X-Client-Info': `${env.APP_NAME}/${env.APP_VERSION}`,
    },
  },
})

// Log de inicialização em modo de desenvolvimento
logger.debug('Supabase client inicializado', {
  url: env.SUPABASE_URL,
  version: env.APP_VERSION,
})

// Example type for credentials, if needed by client-side logic before calling Supabase
// This might be better placed or duplicated in types.ts if shared across components
// For now, it's just illustrative if supabaseClient.ts needed to type check functions.
// Actual Supabase functions like auth.signInWithPassword will have their own { email, password } types.
// export type SupabaseUserCredentials = UserCredentials;

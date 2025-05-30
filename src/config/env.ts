/**
 * Configuração e validação de variáveis de ambiente
 * 
 * Este módulo garante que todas as variáveis de ambiente necessárias
 * estejam presentes e válidas antes da aplicação iniciar.
 */

/**
 * Interface que define todas as variáveis de ambiente obrigatórias
 */
interface RequiredEnvConfig {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  GEMINI_API_KEY: string;
}

/**
 * Interface que define todas as variáveis de ambiente opcionais
 */
interface OptionalEnvConfig {
  APP_NAME: string;
  APP_VERSION: string;
  APP_DESCRIPTION: string;
  DEV_MODE: boolean;
  LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
  ANALYTICS_ID?: string;
  SENTRY_DSN?: string;
  ENABLE_BETA_FEATURES: boolean;
  ENABLE_DEBUG_MODE: boolean;
}

/**
 * Interface completa de configuração do ambiente
 */
export interface EnvConfig extends RequiredEnvConfig, OptionalEnvConfig {}

/**
 * Valida se uma URL é válida
 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Valida se uma chave de API tem o formato esperado
 */
function isValidApiKey(key: string): boolean {
  return key.length > 10 && !key.includes('your_') && !key.includes('example');
}

/**
 * Converte string para boolean de forma segura
 */
function parseBoolean(value: string | undefined, defaultValue: boolean = false): boolean {
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true';
}

/**
 * Valida e retorna as variáveis de ambiente obrigatórias
 */
function validateRequiredEnv(): RequiredEnvConfig {
  const errors: string[] = [];
  
  // Supabase URL
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) {
    errors.push('VITE_SUPABASE_URL é obrigatória');
  } else if (!isValidUrl(supabaseUrl)) {
    errors.push('VITE_SUPABASE_URL deve ser uma URL válida');
  } else if (!supabaseUrl.includes('supabase.co') && !supabaseUrl.includes('localhost')) {
    errors.push('VITE_SUPABASE_URL deve ser uma URL do Supabase válida');
  }
  
  // Supabase Anon Key
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseAnonKey) {
    errors.push('VITE_SUPABASE_ANON_KEY é obrigatória');
  } else if (!isValidApiKey(supabaseAnonKey)) {
    errors.push('VITE_SUPABASE_ANON_KEY deve ser uma chave válida (não pode ser um placeholder)');
  }
  
  // Gemini API Key
  const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!geminiApiKey) {
    errors.push('VITE_GEMINI_API_KEY é obrigatória');
  } else if (!isValidApiKey(geminiApiKey)) {
    errors.push('VITE_GEMINI_API_KEY deve ser uma chave válida (não pode ser um placeholder)');
  }
  
  if (errors.length > 0) {
    const errorMessage = [
      '❌ Erro na configuração de variáveis de ambiente:',
      '',
      ...errors.map(error => `  • ${error}`),
      '',
      '📋 Para corrigir:',
      '  1. Copie o arquivo .env.example para .env',
      '  2. Substitua os valores de exemplo pelos valores reais',
      '  3. Reinicie o servidor de desenvolvimento',
      '',
      '📚 Consulte o arquivo docs/PROJECT_RULES.md para mais informações'
    ].join('\n');
    
    throw new Error(errorMessage);
  }
  
  return {
    SUPABASE_URL: supabaseUrl,
    SUPABASE_ANON_KEY: supabaseAnonKey,
    GEMINI_API_KEY: geminiApiKey,
  };
}

/**
 * Retorna as variáveis de ambiente opcionais com valores padrão
 */
function getOptionalEnv(): OptionalEnvConfig {
  const logLevel = import.meta.env.VITE_LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error';
  
  return {
    APP_NAME: import.meta.env.VITE_APP_NAME || 'Gerador de Despachos Inteligente',
    APP_VERSION: import.meta.env.VITE_APP_VERSION || '1.0.0',
    APP_DESCRIPTION: import.meta.env.VITE_APP_DESCRIPTION || 'Sistema inteligente para geração automatizada de despachos fiscais',
    DEV_MODE: parseBoolean(import.meta.env.VITE_DEV_MODE, import.meta.env.DEV),
    LOG_LEVEL: ['debug', 'info', 'warn', 'error'].includes(logLevel) ? logLevel : 'info',
    ANALYTICS_ID: import.meta.env.VITE_ANALYTICS_ID,
    SENTRY_DSN: import.meta.env.VITE_SENTRY_DSN,
    ENABLE_BETA_FEATURES: parseBoolean(import.meta.env.VITE_ENABLE_BETA_FEATURES),
    ENABLE_DEBUG_MODE: parseBoolean(import.meta.env.VITE_ENABLE_DEBUG_MODE),
  };
}

/**
 * Valida e exporta toda a configuração de ambiente
 */
function createEnvConfig(): EnvConfig {
  try {
    const requiredEnv = validateRequiredEnv();
    const optionalEnv = getOptionalEnv();
    
    const config = {
      ...requiredEnv,
      ...optionalEnv,
    };
    
    // Log da configuração em modo de desenvolvimento (sem expor secrets)
    if (config.DEV_MODE && config.LOG_LEVEL === 'debug') {
      console.group('🔧 Configuração de Ambiente');
      console.log('📱 App:', config.APP_NAME, 'v' + config.APP_VERSION);
      console.log('🌐 Supabase URL:', config.SUPABASE_URL);
      console.log('🔑 Supabase Key:', config.SUPABASE_ANON_KEY.substring(0, 20) + '...');
      console.log('🤖 Gemini Key:', config.GEMINI_API_KEY.substring(0, 20) + '...');
      console.log('🚀 Modo Dev:', config.DEV_MODE);
      console.log('📊 Log Level:', config.LOG_LEVEL);
      if (config.ENABLE_BETA_FEATURES) {
        console.log('🧪 Features Beta: Habilitadas');
      }
      if (config.ENABLE_DEBUG_MODE) {
        console.log('🐛 Modo Debug: Habilitado');
      }
      console.groupEnd();
    }
    
    return config;
  } catch (error) {
    // Em caso de erro, exibir no console e relançar
    console.error(error instanceof Error ? error.message : 'Erro desconhecido na configuração');
    throw error;
  }
}

/**
 * Configuração validada e pronta para uso
 * 
 * @example
 * ```typescript
 * import { env } from '@/config/env';
 * 
 * // Usar as variáveis validadas
 * const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
 * ```
 */
export const env = createEnvConfig();

/**
 * Utilitário para verificar se estamos em modo de desenvolvimento
 */
export const isDev = env.DEV_MODE;

/**
 * Utilitário para verificar se estamos em modo de produção
 */
export const isProd = !env.DEV_MODE;

/**
 * Utilitário para verificar se features beta estão habilitadas
 */
export const isBetaEnabled = env.ENABLE_BETA_FEATURES;

/**
 * Utilitário para verificar se modo debug está habilitado
 */
export const isDebugEnabled = env.ENABLE_DEBUG_MODE;

/**
 * Utilitário para logging condicional baseado no nível configurado
 */
export const logger = {
  debug: (...args: any[]) => {
    if (['debug'].includes(env.LOG_LEVEL)) {
      console.debug('🐛', ...args);
    }
  },
  info: (...args: any[]) => {
    if (['debug', 'info'].includes(env.LOG_LEVEL)) {
      console.info('ℹ️', ...args);
    }
  },
  warn: (...args: any[]) => {
    if (['debug', 'info', 'warn'].includes(env.LOG_LEVEL)) {
      console.warn('⚠️', ...args);
    }
  },
  error: (...args: any[]) => {
    console.error('❌', ...args);
  },
};

// Validar configuração na inicialização
if (typeof window !== 'undefined') {
  logger.info('Configuração de ambiente carregada com sucesso');
}
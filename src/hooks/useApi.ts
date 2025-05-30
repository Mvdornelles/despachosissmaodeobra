/**
 * Hook para gerenciar chamadas de API
 * 
 * Este hook fornece uma interface consistente para fazer chamadas HTTP,
 * incluindo cache, retry, loading states e tratamento de erros.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { errorHandler } from '../utils/errorHandler';

// Tipos e interfaces
interface ApiConfig {
  baseURL?: string;
  timeout?: number;
  headers?: Record<string, string>;
  retries?: number;
  retryDelay?: number;
  cache?: boolean;
  cacheTime?: number;
}

interface ApiRequest {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  data?: any;
  params?: Record<string, any>;
  headers?: Record<string, string>;
  timeout?: number;
  signal?: AbortSignal;
}

interface ApiResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  config: ApiRequest;
}

interface ApiError {
  message: string;
  status?: number;
  statusText?: string;
  data?: any;
  config?: ApiRequest;
}

interface ApiState<T = any> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
  status: number | null;
  lastFetch: Date | null;
}

interface UseApiOptions<T = any> {
  immediate?: boolean; // Executar imediatamente
  schema?: z.ZodSchema<T>; // Schema de validação
  onSuccess?: (data: T, response: ApiResponse<T>) => void;
  onError?: (error: ApiError) => void;
  transform?: (data: any) => T; // Transformar dados
  cache?: boolean;
  cacheKey?: string;
  dependencies?: any[]; // Dependências para re-fetch
}

// Cache global
const apiCache = new Map<string, { data: any; timestamp: number; ttl: number }>();

// Configuração padrão
const defaultConfig: ApiConfig = {
  timeout: 10000,
  retries: 3,
  retryDelay: 1000,
  cache: false,
  cacheTime: 5 * 60 * 1000, // 5 minutos
};

let globalConfig: ApiConfig = { ...defaultConfig };

// Função para configurar API globalmente
export function configureApi(config: Partial<ApiConfig>) {
  globalConfig = { ...globalConfig, ...config };
}

// Função para fazer requisições HTTP
async function makeRequest<T = any>(request: ApiRequest, config: ApiConfig = {}): Promise<ApiResponse<T>> {
  const finalConfig = { ...globalConfig, ...config };
  const { baseURL, timeout, headers: defaultHeaders } = finalConfig;
  
  // Construir URL
  const url = baseURL ? `${baseURL}${request.url}` : request.url;
  
  // Construir headers
  const headers = {
    'Content-Type': 'application/json',
    ...defaultHeaders,
    ...request.headers,
  };
  
  // Construir query params
  const searchParams = new URLSearchParams();
  if (request.params) {
    Object.entries(request.params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
  }
  
  const finalUrl = searchParams.toString() ? `${url}?${searchParams}` : url;
  
  // Configurar fetch options
  const fetchOptions: RequestInit = {
    method: request.method || 'GET',
    headers,
    signal: request.signal,
  };
  
  // Adicionar body se necessário
  if (request.data && ['POST', 'PUT', 'PATCH'].includes(request.method || 'GET')) {
    fetchOptions.body = JSON.stringify(request.data);
  }
  
  // Timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  if (!request.signal) {
    fetchOptions.signal = controller.signal;
  }
  
  try {
    const response = await fetch(finalUrl, fetchOptions);
    clearTimeout(timeoutId);
    
    // Parse response
    let data: any;
    const contentType = response.headers.get('content-type');
    
    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }
    
    // Verificar se a resposta foi bem-sucedida
    if (!response.ok) {
      throw {
        message: `HTTP ${response.status}: ${response.statusText}`,
        status: response.status,
        statusText: response.statusText,
        data,
        config: request,
      } as ApiError;
    }
    
    // Construir headers object
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });
    
    return {
      data,
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      config: request,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw {
          message: 'Request timeout',
          config: request,
        } as ApiError;
      }
      
      throw {
        message: error.message,
        config: request,
      } as ApiError;
    }
    
    throw error;
  }
}

// Hook principal
export function useApi<T = any>(
  request: ApiRequest | null,
  options: UseApiOptions<T> = {}
) {
  const {
    immediate = false,
    schema,
    onSuccess,
    onError,
    transform,
    cache = false,
    cacheKey,
    dependencies = [],
  } = options;

  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: false,
    error: null,
    status: null,
    lastFetch: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const requestRef = useRef(request);
  const retryCountRef = useRef(0);

  // Atualizar request ref
  useEffect(() => {
    requestRef.current = request;
  }, [request]);

  // Função para gerar cache key
  const getCacheKey = useCallback((req: ApiRequest) => {
    if (cacheKey) return cacheKey;
    
    const key = `${req.method || 'GET'}:${req.url}`;
    if (req.params) {
      const params = new URLSearchParams(req.params).toString();
      return `${key}?${params}`;
    }
    return key;
  }, [cacheKey]);

  // Função para verificar cache
  const getCachedData = useCallback((req: ApiRequest) => {
    if (!cache) return null;
    
    const key = getCacheKey(req);
    const cached = apiCache.get(key);
    
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data;
    }
    
    // Remover cache expirado
    if (cached) {
      apiCache.delete(key);
    }
    
    return null;
  }, [cache, getCacheKey]);

  // Função para salvar no cache
  const setCachedData = useCallback((req: ApiRequest, data: T) => {
    if (!cache) return;
    
    const key = getCacheKey(req);
    apiCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: globalConfig.cacheTime || 5 * 60 * 1000,
    });
  }, [cache, getCacheKey]);

  // Função para executar requisição
  const execute = useCallback(async (customRequest?: ApiRequest) => {
    const req = customRequest || requestRef.current;
    if (!req) return;

    // Cancelar requisição anterior
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Verificar cache
    const cachedData = getCachedData(req);
    if (cachedData) {
      setState({
        data: cachedData,
        loading: false,
        error: null,
        status: 200,
        lastFetch: new Date(),
      });
      
      onSuccess?.(cachedData, {
        data: cachedData,
        status: 200,
        statusText: 'OK (cached)',
        headers: {},
        config: req,
      });
      
      return cachedData;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));
    
    // Criar novo AbortController
    abortControllerRef.current = new AbortController();
    const requestWithSignal = {
      ...req,
      signal: abortControllerRef.current.signal,
    };

    try {
      const response = await makeRequest<T>(requestWithSignal);
      let { data } = response;
      
      // Transformar dados se necessário
      if (transform) {
        data = transform(data);
      }
      
      // Validar com schema se fornecido
      if (schema) {
        try {
          data = schema.parse(data);
        } catch (validationError) {
          throw {
            message: 'Validation error',
            data: validationError,
            config: req,
          } as ApiError;
        }
      }
      
      setState({
        data,
        loading: false,
        error: null,
        status: response.status,
        lastFetch: new Date(),
      });
      
      // Salvar no cache
      setCachedData(req, data);
      
      // Reset retry count
      retryCountRef.current = 0;
      
      onSuccess?.(data, response);
      
      logger.info('API request successful', {
        url: req.url,
        method: req.method,
        status: response.status,
      });
      
      return data;
    } catch (error) {
      const apiError = error as ApiError;
      
      setState(prev => ({
        ...prev,
        loading: false,
        error: apiError,
        status: apiError.status || null,
      }));
      
      // Retry logic
      const shouldRetry = 
        retryCountRef.current < (globalConfig.retries || 0) &&
        (!apiError.status || apiError.status >= 500);
      
      if (shouldRetry) {
        retryCountRef.current++;
        const delay = (globalConfig.retryDelay || 1000) * Math.pow(2, retryCountRef.current - 1);
        
        logger.warn(`API request failed, retrying in ${delay}ms`, {
          url: req.url,
          attempt: retryCountRef.current,
          error: apiError.message,
        });
        
        setTimeout(() => execute(req), delay);
        return;
      }
      
      onError?.(apiError);
      
      logger.error('API request failed', {
        url: req.url,
        method: req.method,
        error: apiError.message,
        status: apiError.status,
      });
      
      // Report to error handler
      errorHandler.handleError({
        message: `API Error: ${apiError.message}`,
        context: {
          url: req.url,
          method: req.method,
          status: apiError.status,
        },
        severity: 'error',
        timestamp: new Date().toISOString(),
      });
      
      throw apiError;
    }
  }, [getCachedData, setCachedData, transform, schema, onSuccess, onError]);

  // Função para cancelar requisição
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setState(prev => ({ ...prev, loading: false }));
    }
  }, []);

  // Função para limpar estado
  const reset = useCallback(() => {
    cancel();
    setState({
      data: null,
      loading: false,
      error: null,
      status: null,
      lastFetch: null,
    });
    retryCountRef.current = 0;
  }, [cancel]);

  // Executar imediatamente se solicitado
  useEffect(() => {
    if (immediate && request) {
      execute();
    }
  }, [immediate, ...dependencies]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    ...state,
    execute,
    cancel,
    reset,
    refetch: () => execute(),
  };
}

// Hook para GET requests
export function useGet<T = any>(
  url: string,
  options: Omit<UseApiOptions<T>, 'immediate'> & { params?: Record<string, any> } = {}
) {
  const { params, ...restOptions } = options;
  
  return useApi<T>(
    { url, method: 'GET', params },
    { immediate: true, cache: true, ...restOptions }
  );
}

// Hook para POST requests
export function usePost<T = any>(
  url: string,
  options: UseApiOptions<T> = {}
) {
  return useApi<T>(
    { url, method: 'POST' },
    options
  );
}

// Hook para PUT requests
export function usePut<T = any>(
  url: string,
  options: UseApiOptions<T> = {}
) {
  return useApi<T>(
    { url, method: 'PUT' },
    options
  );
}

// Hook para DELETE requests
export function useDelete<T = any>(
  url: string,
  options: UseApiOptions<T> = {}
) {
  return useApi<T>(
    { url, method: 'DELETE' },
    options
  );
}

// Função para limpar cache
export function clearApiCache(pattern?: string) {
  if (pattern) {
    const regex = new RegExp(pattern);
    for (const key of apiCache.keys()) {
      if (regex.test(key)) {
        apiCache.delete(key);
      }
    }
  } else {
    apiCache.clear();
  }
}

// Exportar tipos
export type {
  ApiConfig,
  ApiRequest,
  ApiResponse,
  ApiError,
  ApiState,
  UseApiOptions,
};
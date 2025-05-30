/**
 * Hook para gerenciamento de operações assíncronas
 * 
 * Este hook fornece uma interface consistente para gerenciar
 * operações assíncronas com estados de loading, error e retry.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { logger } from '../utils/logger';
import { errorHandler, AppError } from '../utils/errorHandler';
import { AsyncState, RetryConfig } from './types';

/**
 * Configuração do hook useAsync
 */
interface UseAsyncConfig<T> {
  immediate?: boolean;
  retryConfig?: RetryConfig;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
  onRetry?: (attempt: number) => void;
  timeout?: number;
  abortOnUnmount?: boolean;
}

/**
 * Hook para operações assíncronas
 */
export function useAsync<T = any, P extends any[] = any[]>(
  asyncFunction: (...args: P) => Promise<T>,
  config: UseAsyncConfig<T> = {}
) {
  const {
    immediate = false,
    retryConfig = {
      maxAttempts: 3,
      delay: 1000,
      backoff: 'exponential',
      retryCondition: (error) => !(error instanceof AppError && error.severity === 'critical'),
    },
    onSuccess,
    onError,
    onRetry,
    timeout = 30000,
    abortOnUnmount = true,
  } = config;

  // Estado da operação assíncrona
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    error: null,
    isLoading: false,
    isSuccess: false,
    isError: false,
    attempt: 0,
    lastExecutedAt: null,
  });

  // Referências para controle
  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const lastArgsRef = useRef<P | null>(null);

  /**
   * Calcula delay para retry com backoff
   */
  const calculateDelay = useCallback((attempt: number, baseDelay: number, backoff: string): number => {
    switch (backoff) {
      case 'exponential':
        return baseDelay * Math.pow(2, attempt - 1);
      case 'linear':
        return baseDelay * attempt;
      case 'fixed':
      default:
        return baseDelay;
    }
  }, []);

  /**
   * Atualiza estado de forma segura
   */
  const safeSetState = useCallback((updates: Partial<AsyncState<T>>) => {
    if (isMountedRef.current) {
      setState(prev => ({ ...prev, ...updates }));
    }
  }, []);

  /**
   * Executa a função assíncrona
   */
  const execute = useCallback(async (...args: P): Promise<T | undefined> => {
    // Cancela operação anterior se existir
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Cria novo AbortController
    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;

    // Salva argumentos para retry
    lastArgsRef.current = args;

    // Atualiza estado inicial
    safeSetState({
      isLoading: true,
      isError: false,
      isSuccess: false,
      error: null,
      attempt: state.attempt + 1,
      lastExecutedAt: new Date(),
    });

    await logger.debug('Iniciando operação assíncrona', {
      component: 'useAsync',
      action: 'execute',
      attempt: state.attempt + 1,
      hasTimeout: !!timeout,
    });

    try {
      // Configura timeout se especificado
      if (timeout > 0) {
        timeoutRef.current = setTimeout(() => {
          if (abortControllerRef.current) {
            abortControllerRef.current.abort();
          }
        }, timeout);
      }

      // Executa função assíncrona
      const result = await asyncFunction(...args);

      // Verifica se foi cancelado
      if (signal.aborted) {
        await logger.debug('Operação cancelada', {
          component: 'useAsync',
          action: 'execute',
        });
        return;
      }

      // Limpa timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      // Atualiza estado de sucesso
      safeSetState({
        data: result,
        isLoading: false,
        isSuccess: true,
        isError: false,
        error: null,
      });

      await logger.info('Operação assíncrona concluída com sucesso', {
        component: 'useAsync',
        action: 'execute',
        attempt: state.attempt + 1,
      });

      // Callback de sucesso
      if (onSuccess) {
        onSuccess(result);
      }

      return result;
    } catch (error) {
      // Limpa timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      // Verifica se foi cancelado
      if (signal.aborted) {
        await logger.debug('Operação cancelada durante execução', {
          component: 'useAsync',
          action: 'execute',
        });
        return;
      }

      const handledError = await errorHandler.handleError(error as Error, {
        component: 'useAsync',
        action: 'execute',
        attempt: state.attempt + 1,
      });

      await logger.error('Erro na operação assíncrona', handledError, {
        component: 'useAsync',
        action: 'execute',
        attempt: state.attempt + 1,
      });

      // Atualiza estado de erro
      safeSetState({
        error: handledError,
        isLoading: false,
        isSuccess: false,
        isError: true,
      });

      // Callback de erro
      if (onError) {
        onError(handledError);
      }

      throw handledError;
    }
  }, [asyncFunction, state.attempt, timeout, safeSetState, onSuccess, onError]);

  /**
   * Executa com retry automático
   */
  const executeWithRetry = useCallback(async (...args: P): Promise<T | undefined> => {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
      try {
        const result = await execute(...args);
        return result;
      } catch (error) {
        lastError = error as Error;
        
        // Verifica se deve tentar novamente
        const shouldRetry = attempt < retryConfig.maxAttempts && 
                          retryConfig.retryCondition(lastError);
        
        if (!shouldRetry) {
          break;
        }

        // Callback de retry
        if (onRetry) {
          onRetry(attempt);
        }

        // Calcula delay para próxima tentativa
        const delay = calculateDelay(attempt, retryConfig.delay, retryConfig.backoff);
        
        await logger.info('Tentando novamente após erro', {
          component: 'useAsync',
          action: 'executeWithRetry',
          attempt,
          maxAttempts: retryConfig.maxAttempts,
          delay,
          error: lastError.message,
        });

        // Aguarda antes da próxima tentativa
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // Se chegou aqui, todas as tentativas falharam
    if (lastError) {
      throw lastError;
    }
  }, [execute, retryConfig, onRetry, calculateDelay]);

  /**
   * Cancela operação em andamento
   */
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    safeSetState({
      isLoading: false,
      error: null,
    });

    logger.info('Operação cancelada pelo usuário', {
      component: 'useAsync',
      action: 'cancel',
    });
  }, [safeSetState]);

  /**
   * Reseta estado
   */
  const reset = useCallback(() => {
    cancel();
    
    safeSetState({
      data: null,
      error: null,
      isLoading: false,
      isSuccess: false,
      isError: false,
      attempt: 0,
      lastExecutedAt: null,
    });

    logger.debug('Estado resetado', {
      component: 'useAsync',
      action: 'reset',
    });
  }, [cancel, safeSetState]);

  /**
   * Reexecuta com os últimos argumentos
   */
  const retry = useCallback(async (): Promise<T | undefined> => {
    if (lastArgsRef.current) {
      return executeWithRetry(...lastArgsRef.current);
    } else {
      await logger.warn('Tentativa de retry sem argumentos salvos', {
        component: 'useAsync',
        action: 'retry',
      });
    }
  }, [executeWithRetry]);

  /**
   * Execução imediata se configurado
   */
  useEffect(() => {
    if (immediate && lastArgsRef.current) {
      executeWithRetry(...lastArgsRef.current);
    }
  }, [immediate, executeWithRetry]);

  /**
   * Cleanup no unmount
   */
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      
      if (abortOnUnmount) {
        cancel();
      }
    };
  }, [cancel, abortOnUnmount]);

  return {
    // Estado
    ...state,
    
    // Ações
    execute,
    executeWithRetry,
    cancel,
    reset,
    retry,
    
    // Utilitários
    canRetry: state.isError && state.attempt < retryConfig.maxAttempts,
    hasData: state.data !== null,
    isEmpty: state.data === null && !state.isLoading && !state.isError,
  };
}

/**
 * Hook simplificado para operações assíncronas sem retry
 */
export function useSimpleAsync<T = any, P extends any[] = any[]>(
  asyncFunction: (...args: P) => Promise<T>,
  immediate = false
) {
  return useAsync(asyncFunction, {
    immediate,
    retryConfig: {
      maxAttempts: 1,
      delay: 0,
      backoff: 'fixed',
      retryCondition: () => false,
    },
  });
}

/**
 * Hook para operações com retry agressivo
 */
export function useAsyncWithRetry<T = any, P extends any[] = any[]>(
  asyncFunction: (...args: P) => Promise<T>,
  maxAttempts = 5,
  immediate = false
) {
  return useAsync(asyncFunction, {
    immediate,
    retryConfig: {
      maxAttempts,
      delay: 1000,
      backoff: 'exponential',
      retryCondition: (error) => !(error instanceof AppError && error.severity === 'critical'),
    },
  });
}
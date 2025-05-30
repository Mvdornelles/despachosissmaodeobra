/**
 * Hook para tratamento centralizado de erros
 * 
 * Este hook fornece uma interface reativa para capturar, processar
 * e exibir erros de forma consistente em toda a aplicação.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { errorHandler, ErrorInfo, ErrorSeverity } from '../utils/errorHandler';
import { logger } from '../utils/logger';

interface UseErrorHandlerOptions {
  component?: string; // Nome do componente para contexto
  autoReport?: boolean; // Reportar erros automaticamente
  showToast?: boolean; // Exibir toast de erro
  fallbackUI?: boolean; // Mostrar UI de fallback
  onError?: (error: ErrorInfo) => void; // Callback personalizado
  retryable?: boolean; // Permitir retry automático
  maxRetries?: number; // Máximo de tentativas
}

interface ErrorState {
  hasError: boolean;
  error: ErrorInfo | null;
  errorBoundary: boolean;
  retryCount: number;
  isRetrying: boolean;
  lastErrorTime: number;
}

export function useErrorHandler(options: UseErrorHandlerOptions = {}) {
  const {
    component,
    autoReport = true,
    showToast = true,
    fallbackUI = false,
    onError,
    retryable = false,
    maxRetries = 3,
  } = options;

  const [state, setState] = useState<ErrorState>({
    hasError: false,
    error: null,
    errorBoundary: false,
    retryCount: 0,
    isRetrying: false,
    lastErrorTime: 0,
  });

  const componentRef = useRef(component);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Atualizar referência do componente
  useEffect(() => {
    componentRef.current = component;
  }, [component]);

  // Função para processar erro
  const handleError = useCallback(async (
    error: Error | string,
    context?: Record<string, any>,
    severity: ErrorSeverity = 'error'
  ) => {
    const errorInfo: ErrorInfo = {
      message: typeof error === 'string' ? error : error.message,
      stack: typeof error === 'object' ? error.stack : undefined,
      timestamp: new Date().toISOString(),
      severity,
      context: {
        component: componentRef.current,
        ...context,
      },
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    // Atualizar estado
    setState(prev => ({
      ...prev,
      hasError: true,
      error: errorInfo,
      lastErrorTime: Date.now(),
    }));

    // Processar com errorHandler
    if (autoReport) {
      try {
        await errorHandler.handleError(errorInfo);
      } catch (handlerError) {
        logger.error('Erro no errorHandler', handlerError);
      }
    }

    // Callback personalizado
    onError?.(errorInfo);

    // Log local
    logger.error(`[${componentRef.current || 'Unknown'}] ${errorInfo.message}`, {
      error: errorInfo,
      context,
    });

    return errorInfo;
  }, [autoReport, onError]);

  // Função para limpar erro
  const clearError = useCallback(() => {
    setState(prev => ({
      ...prev,
      hasError: false,
      error: null,
      errorBoundary: false,
      retryCount: 0,
      isRetrying: false,
    }));

    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, []);

  // Função para retry
  const retry = useCallback(async (retryFn?: () => Promise<void> | void) => {
    if (!retryable || state.retryCount >= maxRetries) {
      return false;
    }

    setState(prev => ({
      ...prev,
      isRetrying: true,
      retryCount: prev.retryCount + 1,
    }));

    try {
      if (retryFn) {
        await retryFn();
      }
      
      // Se chegou aqui, o retry foi bem-sucedido
      clearError();
      
      logger.info(`Retry bem-sucedido (tentativa ${state.retryCount + 1})`, {
        component: componentRef.current,
      });
      
      return true;
    } catch (retryError) {
      setState(prev => ({ ...prev, isRetrying: false }));
      
      // Se ainda há tentativas, agendar próximo retry
      if (state.retryCount + 1 < maxRetries) {
        const delay = Math.pow(2, state.retryCount) * 1000; // Exponential backoff
        
        retryTimeoutRef.current = setTimeout(() => {
          retry(retryFn);
        }, delay);
        
        logger.warn(`Retry falhou, tentando novamente em ${delay}ms`, {
          component: componentRef.current,
          attempt: state.retryCount + 1,
          maxRetries,
        });
      } else {
        logger.error('Todas as tentativas de retry falharam', {
          component: componentRef.current,
          totalAttempts: maxRetries,
        });
      }
      
      return false;
    }
  }, [retryable, maxRetries, state.retryCount, clearError]);

  // Wrapper para funções assíncronas
  const wrapAsync = useCallback(<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    context?: Record<string, any>
  ): T => {
    return (async (...args: Parameters<T>) => {
      try {
        return await fn(...args);
      } catch (error) {
        await handleError(error as Error, {
          function: fn.name,
          args: args.length > 0 ? args : undefined,
          ...context,
        });
        throw error;
      }
    }) as T;
  }, [handleError]);

  // Wrapper para funções síncronas
  const wrapSync = useCallback(<T extends (...args: any[]) => any>(
    fn: T,
    context?: Record<string, any>
  ): T => {
    return ((...args: Parameters<T>) => {
      try {
        return fn(...args);
      } catch (error) {
        handleError(error as Error, {
          function: fn.name,
          args: args.length > 0 ? args : undefined,
          ...context,
        });
        throw error;
      }
    }) as T;
  }, [handleError]);

  // Error boundary effect
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      handleError(event.reason, {
        type: 'unhandledRejection',
        promise: event.promise,
      }, 'critical');
    };

    const handleError = (event: ErrorEvent) => {
      handleError(event.error || event.message, {
        type: 'globalError',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      }, 'critical');
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
    };
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  // Funções de conveniência
  const reportError = useCallback((error: Error | string, context?: Record<string, any>) => {
    return handleError(error, context, 'error');
  }, [handleError]);

  const reportWarning = useCallback((warning: string, context?: Record<string, any>) => {
    return handleError(warning, context, 'warning');
  }, [handleError]);

  const reportCritical = useCallback((error: Error | string, context?: Record<string, any>) => {
    return handleError(error, context, 'critical');
  }, [handleError]);

  // Verificar se deve mostrar fallback UI
  const shouldShowFallback = fallbackUI && state.hasError && !state.isRetrying;

  return {
    // Estado
    ...state,
    shouldShowFallback,
    canRetry: retryable && state.retryCount < maxRetries,
    
    // Funções principais
    handleError,
    clearError,
    retry,
    
    // Wrappers
    wrapAsync,
    wrapSync,
    
    // Conveniência
    reportError,
    reportWarning,
    reportCritical,
  };
}

// Hook simplificado para componentes
export function useComponentErrorHandler(componentName: string) {
  return useErrorHandler({
    component: componentName,
    autoReport: true,
    showToast: true,
    fallbackUI: true,
  });
}

// Hook para operações críticas
export function useCriticalErrorHandler(options?: Omit<UseErrorHandlerOptions, 'retryable' | 'maxRetries'>) {
  return useErrorHandler({
    ...options,
    retryable: true,
    maxRetries: 5,
    autoReport: true,
  });
}

// Hook para formulários
export function useFormErrorHandler() {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  
  const { handleError, clearError } = useErrorHandler({
    component: 'Form',
    showToast: false,
  });

  const setFieldError = useCallback((field: string, error: string) => {
    setFieldErrors(prev => ({ ...prev, [field]: error }));
  }, []);

  const clearFieldError = useCallback((field: string) => {
    setFieldErrors(prev => {
      const { [field]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  const clearAllFieldErrors = useCallback(() => {
    setFieldErrors({});
  }, []);

  const hasFieldErrors = Object.keys(fieldErrors).length > 0;

  return {
    fieldErrors,
    hasFieldErrors,
    setFieldError,
    clearFieldError,
    clearAllFieldErrors,
    handleError,
    clearError,
  };
}

// Hook para API calls
export function useApiErrorHandler() {
  return useErrorHandler({
    component: 'API',
    autoReport: true,
    retryable: true,
    maxRetries: 3,
  });
}
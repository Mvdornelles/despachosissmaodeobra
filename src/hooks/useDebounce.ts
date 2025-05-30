/**
 * Hook para debounce de valores
 * 
 * Este hook atrasa a atualização de um valor até que pare de mudar
 * por um período especificado, útil para otimizar performance em
 * inputs de busca, validação e chamadas de API.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { logger } from '../utils/logger';

interface UseDebounceOptions {
  leading?: boolean; // Executar na primeira chamada
  trailing?: boolean; // Executar na última chamada (padrão)
  maxWait?: number; // Tempo máximo para aguardar
  onDebounce?: (value: any) => void; // Callback quando o debounce é acionado
}

export function useDebounce<T>(
  value: T,
  delay: number,
  options: UseDebounceOptions = {}
) {
  const {
    leading = false,
    trailing = true,
    maxWait,
    onDebounce,
  } = options;

  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const maxTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastCallTimeRef = useRef<number>(0);
  const lastInvokeTimeRef = useRef<number>(0);
  const leadingRef = useRef<boolean>(true);

  const invokeFunc = useCallback((newValue: T) => {
    setDebouncedValue(newValue);
    onDebounce?.(newValue);
    lastInvokeTimeRef.current = Date.now();
    leadingRef.current = false;
    
    logger.debug('Debounce executado', { value: newValue, delay });
  }, [onDebounce, delay]);

  const shouldInvoke = useCallback((time: number) => {
    const timeSinceLastCall = time - lastCallTimeRef.current;
    const timeSinceLastInvoke = time - lastInvokeTimeRef.current;

    // Primeira chamada ou tempo suficiente passou
    return (
      leadingRef.current ||
      timeSinceLastCall >= delay ||
      (maxWait !== undefined && timeSinceLastInvoke >= maxWait)
    );
  }, [delay, maxWait]);

  const trailingEdge = useCallback((time: number, newValue: T) => {
    timeoutRef.current = null;
    
    if (trailing && lastCallTimeRef.current !== 0) {
      invokeFunc(newValue);
    }
    
    lastCallTimeRef.current = 0;
  }, [trailing, invokeFunc]);

  const timerExpired = useCallback((newValue: T) => {
    const time = Date.now();
    if (shouldInvoke(time)) {
      return trailingEdge(time, newValue);
    }
    
    // Reagendar se ainda não é hora de invocar
    const timeSinceLastCall = time - lastCallTimeRef.current;
    const timeRemaining = delay - timeSinceLastCall;
    
    timeoutRef.current = setTimeout(() => timerExpired(newValue), timeRemaining);
  }, [shouldInvoke, trailingEdge, delay]);

  const leadingEdge = useCallback((time: number, newValue: T) => {
    lastInvokeTimeRef.current = time;
    
    // Iniciar timer para trailing edge
    timeoutRef.current = setTimeout(() => timerExpired(newValue), delay);
    
    // Invocar leading edge
    if (leading) {
      invokeFunc(newValue);
    }
  }, [leading, delay, invokeFunc, timerExpired]);

  useEffect(() => {
    const time = Date.now();
    lastCallTimeRef.current = time;
    
    if (shouldInvoke(time)) {
      if (timeoutRef.current === null) {
        leadingEdge(time, value);
      }
    } else {
      // Cancelar timeout anterior
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      // Agendar novo timeout
      timeoutRef.current = setTimeout(() => timerExpired(value), delay);
    }

    // Configurar maxWait se especificado
    if (maxWait !== undefined && maxTimeoutRef.current === null) {
      maxTimeoutRef.current = setTimeout(() => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          trailingEdge(Date.now(), value);
        }
        maxTimeoutRef.current = null;
      }, maxWait);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (maxTimeoutRef.current) {
        clearTimeout(maxTimeoutRef.current);
        maxTimeoutRef.current = null;
      }
    };
  }, [value, delay, shouldInvoke, leadingEdge, timerExpired, trailingEdge, maxWait]);

  // Função para cancelar debounce pendente
  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (maxTimeoutRef.current) {
      clearTimeout(maxTimeoutRef.current);
      maxTimeoutRef.current = null;
    }
    lastCallTimeRef.current = 0;
    leadingRef.current = true;
    
    logger.debug('Debounce cancelado');
  }, []);

  // Função para forçar execução imediata
  const flush = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      trailingEdge(Date.now(), value);
    }
    
    logger.debug('Debounce forçado');
  }, [trailingEdge, value]);

  // Verificar se há debounce pendente
  const isPending = useCallback(() => {
    return timeoutRef.current !== null;
  }, []);

  return {
    debouncedValue,
    cancel,
    flush,
    isPending,
  };
}

// Hook simplificado para casos comuns
export function useSimpleDebounce<T>(value: T, delay: number = 300) {
  const { debouncedValue } = useDebounce(value, delay);
  return debouncedValue;
}

// Hook para debounce de funções
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
  options: UseDebounceOptions = {}
) {
  const callbackRef = useRef(callback);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const argsRef = useRef<Parameters<T>>();
  
  // Atualizar callback ref
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const debouncedCallback = useCallback((...args: Parameters<T>) => {
    argsRef.current = args;
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    const { leading = false, trailing = true } = options;
    
    if (leading && !timeoutRef.current) {
      callbackRef.current(...args);
      options.onDebounce?.(args);
    }
    
    timeoutRef.current = setTimeout(() => {
      if (trailing) {
        callbackRef.current(...(argsRef.current || args));
        options.onDebounce?.(argsRef.current || args);
      }
      timeoutRef.current = null;
    }, delay);
    
    logger.debug('Callback debounced agendado', { delay });
  }, [delay, options]);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const flush = useCallback(() => {
    if (timeoutRef.current && argsRef.current) {
      clearTimeout(timeoutRef.current);
      callbackRef.current(...argsRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const isPending = useCallback(() => {
    return timeoutRef.current !== null;
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    debouncedCallback,
    cancel,
    flush,
    isPending,
  };
}

// Hook para debounce de busca
export function useSearchDebounce(
  searchTerm: string,
  delay: number = 300,
  minLength: number = 2
) {
  const [isSearching, setIsSearching] = useState(false);
  
  const { debouncedValue, isPending } = useDebounce(
    searchTerm,
    delay,
    {
      onDebounce: () => setIsSearching(false),
    }
  );

  useEffect(() => {
    if (searchTerm.length >= minLength && isPending()) {
      setIsSearching(true);
    } else {
      setIsSearching(false);
    }
  }, [searchTerm, minLength, isPending]);

  const shouldSearch = debouncedValue.length >= minLength;
  
  return {
    searchTerm: shouldSearch ? debouncedValue : '',
    isSearching,
    shouldSearch,
  };
}

// Hook para debounce de validação
export function useValidationDebounce<T>(
  value: T,
  validator: (value: T) => Promise<string | null> | string | null,
  delay: number = 500
) {
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  
  const { debouncedValue } = useDebounce(
    value,
    delay,
    {
      onDebounce: async (val) => {
        setIsValidating(true);
        try {
          const error = await validator(val);
          setValidationError(error);
        } catch (err) {
          setValidationError('Erro na validação');
          logger.error('Erro na validação debounced', err);
        } finally {
          setIsValidating(false);
        }
      },
    }
  );

  return {
    validationError,
    isValidating,
    debouncedValue,
  };
}
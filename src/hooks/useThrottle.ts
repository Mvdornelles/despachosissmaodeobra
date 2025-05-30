/**
 * Hook para throttle de valores e funções
 * 
 * Este hook limita a frequência de execução, garantindo que uma função
 * seja executada no máximo uma vez por período especificado.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { logger } from '../utils/logger';

interface UseThrottleOptions {
  leading?: boolean; // Executar na primeira chamada (padrão: true)
  trailing?: boolean; // Executar na última chamada se houver
  onThrottle?: (value: any) => void; // Callback quando o throttle é acionado
}

export function useThrottle<T>(
  value: T,
  delay: number,
  options: UseThrottleOptions = {}
) {
  const {
    leading = true,
    trailing = false,
    onThrottle,
  } = options;

  const [throttledValue, setThrottledValue] = useState<T>(value);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastCallTimeRef = useRef<number>(0);
  const lastArgsRef = useRef<T>(value);
  const hasTrailingRef = useRef<boolean>(false);

  const invokeFunc = useCallback((newValue: T) => {
    setThrottledValue(newValue);
    onThrottle?.(newValue);
    lastCallTimeRef.current = Date.now();
    
    logger.debug('Throttle executado', { value: newValue, delay });
  }, [onThrottle, delay]);

  const shouldInvoke = useCallback((time: number) => {
    const timeSinceLastCall = time - lastCallTimeRef.current;
    return timeSinceLastCall >= delay;
  }, [delay]);

  const trailingEdge = useCallback(() => {
    timeoutRef.current = null;
    
    if (hasTrailingRef.current) {
      invokeFunc(lastArgsRef.current);
    }
    
    hasTrailingRef.current = false;
  }, [invokeFunc]);

  const leadingEdge = useCallback((time: number, newValue: T) => {
    lastCallTimeRef.current = time;
    
    if (leading) {
      invokeFunc(newValue);
    }
  }, [leading, invokeFunc]);

  useEffect(() => {
    const time = Date.now();
    lastArgsRef.current = value;
    
    if (shouldInvoke(time)) {
      leadingEdge(time, value);
      
      if (trailing) {
        hasTrailingRef.current = true;
        timeoutRef.current = setTimeout(trailingEdge, delay);
      }
    } else {
      // Se não pode invocar agora, agendar para trailing se habilitado
      if (trailing) {
        hasTrailingRef.current = true;
        
        if (!timeoutRef.current) {
          const timeRemaining = delay - (time - lastCallTimeRef.current);
          timeoutRef.current = setTimeout(trailingEdge, timeRemaining);
        }
      }
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [value, delay, shouldInvoke, leadingEdge, trailingEdge, trailing]);

  // Função para cancelar throttle pendente
  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    hasTrailingRef.current = false;
    
    logger.debug('Throttle cancelado');
  }, []);

  // Função para forçar execução imediata
  const flush = useCallback(() => {
    if (timeoutRef.current && hasTrailingRef.current) {
      clearTimeout(timeoutRef.current);
      trailingEdge();
    }
    
    logger.debug('Throttle forçado');
  }, [trailingEdge]);

  // Verificar se há throttle pendente
  const isPending = useCallback(() => {
    return timeoutRef.current !== null;
  }, []);

  return {
    throttledValue,
    cancel,
    flush,
    isPending,
  };
}

// Hook simplificado para casos comuns
export function useSimpleThrottle<T>(value: T, delay: number = 100) {
  const { throttledValue } = useThrottle(value, delay);
  return throttledValue;
}

// Hook para throttle de funções
export function useThrottledCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
  options: UseThrottleOptions = {}
) {
  const callbackRef = useRef(callback);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastCallTimeRef = useRef<number>(0);
  const lastArgsRef = useRef<Parameters<T>>();
  const hasTrailingRef = useRef<boolean>(false);
  
  // Atualizar callback ref
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const invokeFunc = useCallback((...args: Parameters<T>) => {
    callbackRef.current(...args);
    options.onThrottle?.(args);
    lastCallTimeRef.current = Date.now();
  }, [options]);

  const shouldInvoke = useCallback((time: number) => {
    const timeSinceLastCall = time - lastCallTimeRef.current;
    return timeSinceLastCall >= delay;
  }, [delay]);

  const trailingEdge = useCallback(() => {
    timeoutRef.current = null;
    
    if (hasTrailingRef.current && lastArgsRef.current) {
      invokeFunc(...lastArgsRef.current);
    }
    
    hasTrailingRef.current = false;
  }, [invokeFunc]);

  const throttledCallback = useCallback((...args: Parameters<T>) => {
    const time = Date.now();
    lastArgsRef.current = args;
    
    const { leading = true, trailing = false } = options;
    
    if (shouldInvoke(time)) {
      if (leading) {
        invokeFunc(...args);
      }
      
      if (trailing) {
        hasTrailingRef.current = true;
        timeoutRef.current = setTimeout(trailingEdge, delay);
      }
    } else {
      if (trailing) {
        hasTrailingRef.current = true;
        
        if (!timeoutRef.current) {
          const timeRemaining = delay - (time - lastCallTimeRef.current);
          timeoutRef.current = setTimeout(trailingEdge, timeRemaining);
        }
      }
    }
    
    logger.debug('Callback throttled agendado', { delay });
  }, [delay, options, shouldInvoke, invokeFunc, trailingEdge]);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    hasTrailingRef.current = false;
  }, []);

  const flush = useCallback(() => {
    if (timeoutRef.current && hasTrailingRef.current && lastArgsRef.current) {
      clearTimeout(timeoutRef.current);
      trailingEdge();
    }
  }, [trailingEdge]);

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
    throttledCallback,
    cancel,
    flush,
    isPending,
  };
}

// Hook para throttle de scroll
export function useScrollThrottle(
  callback: (event: Event) => void,
  delay: number = 100
) {
  const { throttledCallback } = useThrottledCallback(
    callback,
    delay,
    { leading: true, trailing: false }
  );

  useEffect(() => {
    const handleScroll = (event: Event) => {
      throttledCallback(event);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [throttledCallback]);

  return { throttledCallback };
}

// Hook para throttle de resize
export function useResizeThrottle(
  callback: (event: Event) => void,
  delay: number = 250
) {
  const { throttledCallback } = useThrottledCallback(
    callback,
    delay,
    { leading: true, trailing: true }
  );

  useEffect(() => {
    const handleResize = (event: Event) => {
      throttledCallback(event);
    };

    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [throttledCallback]);

  return { throttledCallback };
}

// Hook para throttle de mouse move
export function useMouseMoveThrottle(
  callback: (event: MouseEvent) => void,
  delay: number = 16, // ~60fps
  element?: HTMLElement | null
) {
  const { throttledCallback } = useThrottledCallback(
    callback,
    delay,
    { leading: true, trailing: false }
  );

  useEffect(() => {
    const target = element || window;
    
    const handleMouseMove = (event: MouseEvent) => {
      throttledCallback(event);
    };

    target.addEventListener('mousemove', handleMouseMove as EventListener);
    
    return () => {
      target.removeEventListener('mousemove', handleMouseMove as EventListener);
    };
  }, [throttledCallback, element]);

  return { throttledCallback };
}

// Hook para throttle de API calls
export function useApiThrottle<T extends (...args: any[]) => Promise<any>>(
  apiCall: T,
  delay: number = 1000
) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<Awaited<ReturnType<T>> | null>(null);
  
  const { throttledCallback, isPending, cancel } = useThrottledCallback(
    async (...args: Parameters<T>) => {
      setIsLoading(true);
      setError(null);
      
      try {
        const result = await apiCall(...args);
        setData(result);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('API call failed');
        setError(error);
        logger.error('API call throttled falhou', error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    delay,
    { leading: true, trailing: false }
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setIsLoading(false);
    cancel();
  }, [cancel]);

  return {
    throttledApiCall: throttledCallback,
    isLoading,
    error,
    data,
    isPending,
    cancel,
    reset,
  };
}
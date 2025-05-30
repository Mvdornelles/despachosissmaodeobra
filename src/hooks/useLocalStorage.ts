/**
 * Hook para gerenciamento de localStorage
 * 
 * Este hook fornece uma interface reativa para interagir com o localStorage,
 * incluindo serialização/deserialização automática, validação e sincronização.
 */

import { useState, useEffect, useCallback } from 'react';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { errorHandler } from '../utils/errorHandler';

interface UseLocalStorageOptions<T> {
  defaultValue?: T;
  schema?: z.ZodSchema<T>;
  serialize?: (value: T) => string;
  deserialize?: (value: string) => T;
  syncAcrossTabs?: boolean;
  onError?: (error: Error) => void;
}

export function useLocalStorage<T>(
  key: string,
  options: UseLocalStorageOptions<T> = {}
) {
  const {
    defaultValue,
    schema,
    serialize = JSON.stringify,
    deserialize = JSON.parse,
    syncAcrossTabs = true,
    onError,
  } = options;

  const [storedValue, setStoredValue] = useState<T | undefined>(() => {
    try {
      const item = localStorage.getItem(key);
      if (item === null) {
        return defaultValue;
      }

      const parsed = deserialize(item);
      
      // Validar com schema se fornecido
      if (schema) {
        const validated = schema.parse(parsed);
        return validated;
      }
      
      return parsed;
    } catch (error) {
      logger.error(`Erro ao carregar do localStorage (${key})`, error);
      onError?.(error as Error);
      errorHandler.handleError(error, { context: 'useLocalStorage.initialize', key });
      return defaultValue;
    }
  });

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Função para definir valor
  const setValue = useCallback(async (value: T | ((prev: T | undefined) => T)) => {
    try {
      setIsLoading(true);
      setError(null);

      const valueToStore = value instanceof Function ? value(storedValue) : value;
      
      // Validar com schema se fornecido
      if (schema) {
        schema.parse(valueToStore);
      }

      const serialized = serialize(valueToStore);
      localStorage.setItem(key, serialized);
      setStoredValue(valueToStore);
      
      logger.debug(`Valor salvo no localStorage (${key})`, { value: valueToStore });
    } catch (error) {
      const message = `Erro ao salvar no localStorage (${key})`;
      logger.error(message, error);
      setError(message);
      onError?.(error as Error);
      errorHandler.handleError(error, { context: 'useLocalStorage.setValue', key });
    } finally {
      setIsLoading(false);
    }
  }, [key, storedValue, schema, serialize, onError]);

  // Função para remover valor
  const removeValue = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      localStorage.removeItem(key);
      setStoredValue(defaultValue);
      
      logger.debug(`Valor removido do localStorage (${key})`);
    } catch (error) {
      const message = `Erro ao remover do localStorage (${key})`;
      logger.error(message, error);
      setError(message);
      onError?.(error as Error);
      errorHandler.handleError(error, { context: 'useLocalStorage.removeValue', key });
    } finally {
      setIsLoading(false);
    }
  }, [key, defaultValue, onError]);

  // Função para recarregar valor
  const reloadValue = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const item = localStorage.getItem(key);
      if (item === null) {
        setStoredValue(defaultValue);
        return;
      }

      const parsed = deserialize(item);
      
      // Validar com schema se fornecido
      if (schema) {
        const validated = schema.parse(parsed);
        setStoredValue(validated);
      } else {
        setStoredValue(parsed);
      }
      
      logger.debug(`Valor recarregado do localStorage (${key})`);
    } catch (error) {
      const message = `Erro ao recarregar do localStorage (${key})`;
      logger.error(message, error);
      setError(message);
      onError?.(error as Error);
      errorHandler.handleError(error, { context: 'useLocalStorage.reloadValue', key });
    } finally {
      setIsLoading(false);
    }
  }, [key, defaultValue, schema, deserialize, onError]);

  // Verificar se a chave existe
  const hasValue = useCallback(() => {
    return localStorage.getItem(key) !== null;
  }, [key]);

  // Obter tamanho do valor armazenado
  const getSize = useCallback(() => {
    const item = localStorage.getItem(key);
    return item ? new Blob([item]).size : 0;
  }, [key]);

  // Sincronização entre abas
  useEffect(() => {
    if (!syncAcrossTabs) return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.storageArea === localStorage) {
        try {
          if (e.newValue === null) {
            setStoredValue(defaultValue);
          } else {
            const parsed = deserialize(e.newValue);
            
            // Validar com schema se fornecido
            if (schema) {
              const validated = schema.parse(parsed);
              setStoredValue(validated);
            } else {
              setStoredValue(parsed);
            }
          }
          
          logger.debug(`Valor sincronizado entre abas (${key})`);
        } catch (error) {
          logger.error(`Erro na sincronização entre abas (${key})`, error);
          onError?.(error as Error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key, defaultValue, schema, deserialize, syncAcrossTabs, onError]);

  return {
    value: storedValue,
    setValue,
    removeValue,
    reloadValue,
    hasValue,
    getSize,
    error,
    isLoading,
  };
}

// Hook especializado para objetos
export function useLocalStorageObject<T extends Record<string, any>>(
  key: string,
  defaultValue: T,
  schema?: z.ZodSchema<T>
) {
  const storage = useLocalStorage(key, {
    defaultValue,
    schema,
    syncAcrossTabs: true,
  });

  const updateProperty = useCallback(async (property: keyof T, value: T[keyof T]) => {
    await storage.setValue(prev => ({
      ...prev,
      [property]: value,
    }));
  }, [storage]);

  const removeProperty = useCallback(async (property: keyof T) => {
    await storage.setValue(prev => {
      const { [property]: removed, ...rest } = prev;
      return rest as T;
    });
  }, [storage]);

  return {
    ...storage,
    updateProperty,
    removeProperty,
  };
}

// Hook especializado para arrays
export function useLocalStorageArray<T>(
  key: string,
  defaultValue: T[] = [],
  schema?: z.ZodSchema<T[]>
) {
  const storage = useLocalStorage(key, {
    defaultValue,
    schema,
    syncAcrossTabs: true,
  });

  const addItem = useCallback(async (item: T) => {
    await storage.setValue(prev => [...(prev || []), item]);
  }, [storage]);

  const removeItem = useCallback(async (index: number) => {
    await storage.setValue(prev => {
      const newArray = [...(prev || [])];
      newArray.splice(index, 1);
      return newArray;
    });
  }, [storage]);

  const updateItem = useCallback(async (index: number, item: T) => {
    await storage.setValue(prev => {
      const newArray = [...(prev || [])];
      newArray[index] = item;
      return newArray;
    });
  }, [storage]);

  const clearArray = useCallback(async () => {
    await storage.setValue([]);
  }, [storage]);

  const findItem = useCallback((predicate: (item: T, index: number) => boolean) => {
    return (storage.value || []).find(predicate);
  }, [storage.value]);

  const findIndex = useCallback((predicate: (item: T, index: number) => boolean) => {
    return (storage.value || []).findIndex(predicate);
  }, [storage.value]);

  return {
    ...storage,
    addItem,
    removeItem,
    updateItem,
    clearArray,
    findItem,
    findIndex,
    length: (storage.value || []).length,
  };
}

// Hook para configurações simples
export function useLocalStorageSettings<T extends Record<string, any>>(
  defaultSettings: T,
  schema?: z.ZodSchema<T>
) {
  return useLocalStorageObject('app_settings', defaultSettings, schema);
}
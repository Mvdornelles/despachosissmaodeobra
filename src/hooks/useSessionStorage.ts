/**
 * Hook para gerenciamento de sessionStorage
 * 
 * Este hook fornece uma interface reativa para interagir com o sessionStorage,
 * similar ao useLocalStorage mas para dados temporários da sessão.
 */

import { useState, useEffect, useCallback } from 'react';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { errorHandler } from '../utils/errorHandler';

interface UseSessionStorageOptions<T> {
  defaultValue?: T;
  schema?: z.ZodSchema<T>;
  serialize?: (value: T) => string;
  deserialize?: (value: string) => T;
  onError?: (error: Error) => void;
}

export function useSessionStorage<T>(
  key: string,
  options: UseSessionStorageOptions<T> = {}
) {
  const {
    defaultValue,
    schema,
    serialize = JSON.stringify,
    deserialize = JSON.parse,
    onError,
  } = options;

  const [storedValue, setStoredValue] = useState<T | undefined>(() => {
    try {
      const item = sessionStorage.getItem(key);
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
      logger.error(`Erro ao carregar do sessionStorage (${key})`, error);
      onError?.(error as Error);
      errorHandler.handleError(error, { context: 'useSessionStorage.initialize', key });
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
      sessionStorage.setItem(key, serialized);
      setStoredValue(valueToStore);
      
      logger.debug(`Valor salvo no sessionStorage (${key})`, { value: valueToStore });
    } catch (error) {
      const message = `Erro ao salvar no sessionStorage (${key})`;
      logger.error(message, error);
      setError(message);
      onError?.(error as Error);
      errorHandler.handleError(error, { context: 'useSessionStorage.setValue', key });
    } finally {
      setIsLoading(false);
    }
  }, [key, storedValue, schema, serialize, onError]);

  // Função para remover valor
  const removeValue = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      sessionStorage.removeItem(key);
      setStoredValue(defaultValue);
      
      logger.debug(`Valor removido do sessionStorage (${key})`);
    } catch (error) {
      const message = `Erro ao remover do sessionStorage (${key})`;
      logger.error(message, error);
      setError(message);
      onError?.(error as Error);
      errorHandler.handleError(error, { context: 'useSessionStorage.removeValue', key });
    } finally {
      setIsLoading(false);
    }
  }, [key, defaultValue, onError]);

  // Função para recarregar valor
  const reloadValue = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const item = sessionStorage.getItem(key);
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
      
      logger.debug(`Valor recarregado do sessionStorage (${key})`);
    } catch (error) {
      const message = `Erro ao recarregar do sessionStorage (${key})`;
      logger.error(message, error);
      setError(message);
      onError?.(error as Error);
      errorHandler.handleError(error, { context: 'useSessionStorage.reloadValue', key });
    } finally {
      setIsLoading(false);
    }
  }, [key, defaultValue, schema, deserialize, onError]);

  // Verificar se a chave existe
  const hasValue = useCallback(() => {
    return sessionStorage.getItem(key) !== null;
  }, [key]);

  // Obter tamanho do valor armazenado
  const getSize = useCallback(() => {
    const item = sessionStorage.getItem(key);
    return item ? new Blob([item]).size : 0;
  }, [key]);

  // Limpar todos os dados da sessão
  const clearAll = useCallback(() => {
    try {
      sessionStorage.clear();
      setStoredValue(defaultValue);
      logger.debug('SessionStorage limpo completamente');
    } catch (error) {
      logger.error('Erro ao limpar sessionStorage', error);
      onError?.(error as Error);
    }
  }, [defaultValue, onError]);

  return {
    value: storedValue,
    setValue,
    removeValue,
    reloadValue,
    hasValue,
    getSize,
    clearAll,
    error,
    isLoading,
  };
}

// Hook especializado para objetos temporários
export function useSessionStorageObject<T extends Record<string, any>>(
  key: string,
  defaultValue: T,
  schema?: z.ZodSchema<T>
) {
  const storage = useSessionStorage(key, {
    defaultValue,
    schema,
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

  const mergeObject = useCallback(async (updates: Partial<T>) => {
    await storage.setValue(prev => ({
      ...prev,
      ...updates,
    }));
  }, [storage]);

  return {
    ...storage,
    updateProperty,
    removeProperty,
    mergeObject,
  };
}

// Hook especializado para arrays temporários
export function useSessionStorageArray<T>(
  key: string,
  defaultValue: T[] = [],
  schema?: z.ZodSchema<T[]>
) {
  const storage = useSessionStorage(key, {
    defaultValue,
    schema,
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

  const prependItem = useCallback(async (item: T) => {
    await storage.setValue(prev => [item, ...(prev || [])]);
  }, [storage]);

  const insertItem = useCallback(async (index: number, item: T) => {
    await storage.setValue(prev => {
      const newArray = [...(prev || [])];
      newArray.splice(index, 0, item);
      return newArray;
    });
  }, [storage]);

  return {
    ...storage,
    addItem,
    removeItem,
    updateItem,
    clearArray,
    findItem,
    findIndex,
    prependItem,
    insertItem,
    length: (storage.value || []).length,
  };
}

// Hook para cache temporário de dados
export function useSessionCache<T>(key: string, defaultValue?: T) {
  const storage = useSessionStorage(key, { defaultValue });

  const setWithExpiry = useCallback(async (value: T, expiryMinutes: number = 60) => {
    const expiryTime = Date.now() + (expiryMinutes * 60 * 1000);
    await storage.setValue({
      value,
      expiry: expiryTime,
    } as any);
  }, [storage]);

  const getWithExpiry = useCallback(() => {
    const stored = storage.value as any;
    if (!stored || !stored.expiry) {
      return defaultValue;
    }

    if (Date.now() > stored.expiry) {
      storage.removeValue();
      return defaultValue;
    }

    return stored.value as T;
  }, [storage, defaultValue]);

  const isExpired = useCallback(() => {
    const stored = storage.value as any;
    if (!stored || !stored.expiry) {
      return true;
    }
    return Date.now() > stored.expiry;
  }, [storage]);

  return {
    value: getWithExpiry(),
    setValue: setWithExpiry,
    removeValue: storage.removeValue,
    isExpired,
    error: storage.error,
    isLoading: storage.isLoading,
  };
}

// Hook para dados de formulário temporários
export function useFormSessionStorage<T extends Record<string, any>>(
  formId: string,
  defaultValues: T
) {
  const key = `form_${formId}`;
  const storage = useSessionStorageObject(key, defaultValues);

  const saveField = useCallback(async (fieldName: keyof T, value: T[keyof T]) => {
    await storage.updateProperty(fieldName, value);
  }, [storage]);

  const saveForm = useCallback(async (formData: Partial<T>) => {
    await storage.mergeObject(formData);
  }, [storage]);

  const clearForm = useCallback(async () => {
    await storage.setValue(defaultValues);
  }, [storage, defaultValues]);

  const getField = useCallback((fieldName: keyof T) => {
    return storage.value?.[fieldName] ?? defaultValues[fieldName];
  }, [storage.value, defaultValues]);

  return {
    formData: storage.value || defaultValues,
    saveField,
    saveForm,
    clearForm,
    getField,
    error: storage.error,
    isLoading: storage.isLoading,
  };
}
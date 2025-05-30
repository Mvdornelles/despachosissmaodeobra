/**
 * Hook para gerenciamento de sessão do usuário
 * 
 * Este hook gerencia dados de sessão, incluindo preferências,
 * configurações temporárias e estado da aplicação específico da sessão.
 */

import { useState, useEffect, useCallback } from 'react';
import { SessionData, SessionConfig } from './types';
import { logger } from '../utils/logger';
import { errorHandler } from '../utils/errorHandler';
import { sessionDataSchema } from '../validators/schemas';

const SESSION_STORAGE_KEY = 'app_session_data';
const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 horas

const defaultSessionData: SessionData = {
  userId: null,
  preferences: {
    theme: 'light',
    language: 'pt-BR',
    autoSave: true,
    notifications: true,
  },
  temporaryData: {},
  lastActivity: Date.now(),
  sessionId: null,
  isActive: false,
};

export function useSession(config: SessionConfig = {}) {
  const {
    autoSave = true,
    timeout = SESSION_TIMEOUT,
    onSessionExpired,
    onSessionCreated,
    onSessionUpdated,
  } = config;

  const [sessionData, setSessionData] = useState<SessionData>(defaultSessionData);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Carregar dados da sessão do sessionStorage
  const loadSession = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (!stored) {
        logger.debug('Nenhuma sessão encontrada, criando nova sessão');
        setSessionData(defaultSessionData);
        return;
      }

      const parsed = JSON.parse(stored);
      const validated = sessionDataSchema.parse(parsed);

      // Verificar se a sessão expirou
      const now = Date.now();
      const timeSinceLastActivity = now - validated.lastActivity;

      if (timeSinceLastActivity > timeout) {
        logger.info('Sessão expirada, criando nova sessão');
        await clearSession();
        onSessionExpired?.();
        return;
      }

      // Atualizar última atividade
      const updatedSession = {
        ...validated,
        lastActivity: now,
        isActive: true,
      };

      setSessionData(updatedSession);
      
      if (autoSave) {
        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(updatedSession));
      }

      logger.debug('Sessão carregada com sucesso', { sessionId: updatedSession.sessionId });
    } catch (err) {
      const message = 'Erro ao carregar sessão';
      logger.error(message, err);
      setError(message);
      errorHandler.handleError(err, { context: 'useSession.loadSession' });
    } finally {
      setIsLoading(false);
    }
  }, [timeout, autoSave, onSessionExpired]);

  // Salvar dados da sessão
  const saveSession = useCallback(async (data?: Partial<SessionData>) => {
    try {
      const updatedData = {
        ...sessionData,
        ...data,
        lastActivity: Date.now(),
      };

      const validated = sessionDataSchema.parse(updatedData);
      setSessionData(validated);

      if (autoSave) {
        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(validated));
      }

      onSessionUpdated?.(validated);
      logger.debug('Sessão salva com sucesso');
    } catch (err) {
      const message = 'Erro ao salvar sessão';
      logger.error(message, err);
      setError(message);
      errorHandler.handleError(err, { context: 'useSession.saveSession' });
    }
  }, [sessionData, autoSave, onSessionUpdated]);

  // Criar nova sessão
  const createSession = useCallback(async (userId: string) => {
    try {
      const newSession: SessionData = {
        ...defaultSessionData,
        userId,
        sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        lastActivity: Date.now(),
        isActive: true,
      };

      const validated = sessionDataSchema.parse(newSession);
      setSessionData(validated);

      if (autoSave) {
        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(validated));
      }

      onSessionCreated?.(validated);
      logger.info('Nova sessão criada', { sessionId: validated.sessionId, userId });
    } catch (err) {
      const message = 'Erro ao criar sessão';
      logger.error(message, err);
      setError(message);
      errorHandler.handleError(err, { context: 'useSession.createSession' });
    }
  }, [autoSave, onSessionCreated]);

  // Limpar sessão
  const clearSession = useCallback(async () => {
    try {
      setSessionData(defaultSessionData);
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      logger.info('Sessão limpa com sucesso');
    } catch (err) {
      const message = 'Erro ao limpar sessão';
      logger.error(message, err);
      setError(message);
      errorHandler.handleError(err, { context: 'useSession.clearSession' });
    }
  }, []);

  // Atualizar preferências
  const updatePreferences = useCallback(async (preferences: Partial<SessionData['preferences']>) => {
    await saveSession({
      preferences: {
        ...sessionData.preferences,
        ...preferences,
      },
    });
  }, [sessionData.preferences, saveSession]);

  // Atualizar dados temporários
  const updateTemporaryData = useCallback(async (key: string, value: any) => {
    await saveSession({
      temporaryData: {
        ...sessionData.temporaryData,
        [key]: value,
      },
    });
  }, [sessionData.temporaryData, saveSession]);

  // Remover dados temporários
  const removeTemporaryData = useCallback(async (key: string) => {
    const { [key]: removed, ...rest } = sessionData.temporaryData;
    await saveSession({
      temporaryData: rest,
    });
  }, [sessionData.temporaryData, saveSession]);

  // Verificar se a sessão está ativa
  const isSessionActive = useCallback(() => {
    if (!sessionData.isActive || !sessionData.sessionId) {
      return false;
    }

    const timeSinceLastActivity = Date.now() - sessionData.lastActivity;
    return timeSinceLastActivity < timeout;
  }, [sessionData, timeout]);

  // Renovar sessão (atualizar última atividade)
  const renewSession = useCallback(async () => {
    if (isSessionActive()) {
      await saveSession({ lastActivity: Date.now() });
    }
  }, [isSessionActive, saveSession]);

  // Obter dados temporários
  const getTemporaryData = useCallback((key: string, defaultValue?: any) => {
    return sessionData.temporaryData[key] ?? defaultValue;
  }, [sessionData.temporaryData]);

  // Efeito para carregar sessão na inicialização
  useEffect(() => {
    loadSession();
  }, [loadSession]);

  // Efeito para renovar sessão automaticamente
  useEffect(() => {
    if (!isSessionActive()) return;

    const interval = setInterval(() => {
      renewSession();
    }, 60000); // Renovar a cada minuto

    return () => clearInterval(interval);
  }, [isSessionActive, renewSession]);

  // Efeito para detectar atividade do usuário
  useEffect(() => {
    if (!isSessionActive()) return;

    const handleActivity = () => {
      renewSession();
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
    };
  }, [isSessionActive, renewSession]);

  return {
    // Estado
    sessionData,
    isLoading,
    error,
    isActive: isSessionActive(),

    // Ações
    createSession,
    clearSession,
    saveSession,
    loadSession,
    renewSession,

    // Preferências
    updatePreferences,
    preferences: sessionData.preferences,

    // Dados temporários
    updateTemporaryData,
    removeTemporaryData,
    getTemporaryData,
    temporaryData: sessionData.temporaryData,

    // Utilitários
    sessionId: sessionData.sessionId,
    userId: sessionData.userId,
    lastActivity: sessionData.lastActivity,
  };
}

// Hook simplificado para apenas preferências
export function useSessionPreferences() {
  const { preferences, updatePreferences, isLoading } = useSession();
  return { preferences, updatePreferences, isLoading };
}

// Hook para dados temporários
export function useTemporaryData(key: string, defaultValue?: any) {
  const { getTemporaryData, updateTemporaryData, removeTemporaryData } = useSession();
  
  const value = getTemporaryData(key, defaultValue);
  
  const setValue = useCallback((newValue: any) => {
    updateTemporaryData(key, newValue);
  }, [key, updateTemporaryData]);
  
  const removeValue = useCallback(() => {
    removeTemporaryData(key);
  }, [key, removeTemporaryData]);
  
  return [value, setValue, removeValue] as const;
}
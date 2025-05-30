/**
 * Hook para gerenciamento de estado global da aplicação
 * 
 * Este hook centraliza o estado principal da aplicação,
 * incluindo dados extraídos, configurações e estado da UI.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { logger } from '../utils/logger';
import { errorHandler, AppValidationError } from '../utils/errorHandler';
import { validateData, ExtractedDataSchema, AppConfigSchema } from '../validators/schemas';
import { ExtractedData, AppConfig } from '../validators/schemas';
import { AppState, AppStateConfig } from './types';

/**
 * Configuração padrão da aplicação
 */
const DEFAULT_CONFIG: AppConfig = {
  theme: 'light',
  language: 'pt-BR',
  autoSave: true,
  notifications: true,
  debugMode: false,
  maxFileSize: 10485760, // 10MB
  allowedFileTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
  apiTimeout: 30000,
  retryAttempts: 3,
  enableOCR: true,
  enableAI: true,
  autoValidation: true,
};

/**
 * Dados extraídos padrão
 */
const DEFAULT_EXTRACTED_DATA: ExtractedData = {
  NomeContribuinte: '',
  CPFContribuinte: '',
  EnderecoContribuinte: '',
  EnderecoImovel: '',
  InscricaoImobiliaria: '',
  TipoObra: '',
  AreaConstrucao: '',
  ValorAvaliacaoMaoObraISSQN: '',
  ValorRecolherISSQN: '',
  PercentualISSQN: '3',
  NomeResponsavelTecnico: '',
  RegistroResponsavelTecnico: '',
  NomeFiscalAuditor: '',
  TemplateDespacho: '',
};

/**
 * Chaves para localStorage
 */
const STORAGE_KEYS = {
  CONFIG: 'app_config',
  EXTRACTED_DATA: 'extracted_data',
  SESSION_DATA: 'session_data',
  RECENT_FILES: 'recent_files',
} as const;

/**
 * Hook de estado global da aplicação
 */
export function useAppState(config: AppStateConfig = {}) {
  const {
    persistState = true,
    autoSave = true,
    onStateChange,
    onError,
  } = config;

  // Estado principal
  const [state, setState] = useState<AppState>({
    extractedData: DEFAULT_EXTRACTED_DATA,
    config: DEFAULT_CONFIG,
    isLoading: false,
    isDirty: false,
    lastSaved: null,
    errors: {},
    warnings: {},
    recentFiles: [],
    sessionData: {
      startTime: new Date(),
      documentsProcessed: 0,
      lastActivity: new Date(),
    },
  });

  // Referência para debounce do auto-save
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitializedRef = useRef(false);

  /**
   * Carrega estado do localStorage
   */
  const loadFromStorage = useCallback(async () => {
    if (!persistState) return;

    try {
      await logger.debug('Carregando estado do localStorage', {
        component: 'useAppState',
        action: 'loadFromStorage',
      });

      const savedConfig = localStorage.getItem(STORAGE_KEYS.CONFIG);
      const savedExtractedData = localStorage.getItem(STORAGE_KEYS.EXTRACTED_DATA);
      const savedSessionData = localStorage.getItem(STORAGE_KEYS.SESSION_DATA);
      const savedRecentFiles = localStorage.getItem(STORAGE_KEYS.RECENT_FILES);

      const updates: Partial<AppState> = {};

      // Carrega configuração
      if (savedConfig) {
        try {
          const parsedConfig = JSON.parse(savedConfig);
          validateData(parsedConfig, AppConfigSchema);
          updates.config = { ...DEFAULT_CONFIG, ...parsedConfig };
        } catch (error) {
          await logger.warn('Configuração salva inválida, usando padrão', {
            component: 'useAppState',
            error: (error as Error).message,
          });
        }
      }

      // Carrega dados extraídos
      if (savedExtractedData) {
        try {
          const parsedData = JSON.parse(savedExtractedData);
          validateData(parsedData, ExtractedDataSchema);
          updates.extractedData = parsedData;
        } catch (error) {
          await logger.warn('Dados extraídos salvos inválidos, usando padrão', {
            component: 'useAppState',
            error: (error as Error).message,
          });
        }
      }

      // Carrega dados da sessão
      if (savedSessionData) {
        try {
          const parsedSessionData = JSON.parse(savedSessionData);
          updates.sessionData = {
            ...parsedSessionData,
            startTime: new Date(parsedSessionData.startTime),
            lastActivity: new Date(parsedSessionData.lastActivity),
          };
        } catch (error) {
          await logger.warn('Dados de sessão salvos inválidos', {
            component: 'useAppState',
            error: (error as Error).message,
          });
        }
      }

      // Carrega arquivos recentes
      if (savedRecentFiles) {
        try {
          const parsedRecentFiles = JSON.parse(savedRecentFiles);
          if (Array.isArray(parsedRecentFiles)) {
            updates.recentFiles = parsedRecentFiles;
          }
        } catch (error) {
          await logger.warn('Lista de arquivos recentes inválida', {
            component: 'useAppState',
            error: (error as Error).message,
          });
        }
      }

      if (Object.keys(updates).length > 0) {
        setState(prev => ({ ...prev, ...updates }));
        
        await logger.info('Estado carregado do localStorage', {
          component: 'useAppState',
          action: 'loadFromStorage',
          loadedKeys: Object.keys(updates),
        });
      }
    } catch (error) {
      await logger.error('Erro ao carregar estado do localStorage', error as Error, {
        component: 'useAppState',
        action: 'loadFromStorage',
      });
      
      if (onError) {
        onError(error as Error);
      }
    }
  }, [persistState, onError]);

  /**
   * Salva estado no localStorage
   */
  const saveToStorage = useCallback(async (stateToSave: AppState) => {
    if (!persistState) return;

    try {
      await logger.debug('Salvando estado no localStorage', {
        component: 'useAppState',
        action: 'saveToStorage',
      });

      localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(stateToSave.config));
      localStorage.setItem(STORAGE_KEYS.EXTRACTED_DATA, JSON.stringify(stateToSave.extractedData));
      localStorage.setItem(STORAGE_KEYS.SESSION_DATA, JSON.stringify(stateToSave.sessionData));
      localStorage.setItem(STORAGE_KEYS.RECENT_FILES, JSON.stringify(stateToSave.recentFiles));

      await logger.debug('Estado salvo no localStorage', {
        component: 'useAppState',
        action: 'saveToStorage',
      });
    } catch (error) {
      await logger.error('Erro ao salvar estado no localStorage', error as Error, {
        component: 'useAppState',
        action: 'saveToStorage',
      });
      
      if (onError) {
        onError(error as Error);
      }
    }
  }, [persistState, onError]);

  /**
   * Atualiza estado com validação
   */
  const updateState = useCallback(async (updates: Partial<AppState>) => {
    try {
      setState(prev => {
        const newState = {
          ...prev,
          ...updates,
          isDirty: true,
          sessionData: {
            ...prev.sessionData,
            lastActivity: new Date(),
          },
        };

        // Notifica mudança de estado
        if (onStateChange) {
          onStateChange(newState, prev);
        }

        // Auto-save com debounce
        if (autoSave && persistState) {
          if (autoSaveTimeoutRef.current) {
            clearTimeout(autoSaveTimeoutRef.current);
          }
          
          autoSaveTimeoutRef.current = setTimeout(() => {
            saveToStorage(newState);
            setState(current => ({ ...current, isDirty: false, lastSaved: new Date() }));
          }, 1000); // Debounce de 1 segundo
        }

        return newState;
      });

      await logger.debug('Estado atualizado', {
        component: 'useAppState',
        action: 'updateState',
        updatedKeys: Object.keys(updates),
      });
    } catch (error) {
      await logger.error('Erro ao atualizar estado', error as Error, {
        component: 'useAppState',
        action: 'updateState',
      });
      
      if (onError) {
        onError(error as Error);
      }
    }
  }, [autoSave, persistState, onStateChange, onError, saveToStorage]);

  /**
   * Atualiza dados extraídos
   */
  const updateExtractedData = useCallback(async (
    data: Partial<ExtractedData>,
    validate = true
  ) => {
    try {
      const newData = { ...state.extractedData, ...data };
      
      if (validate) {
        validateData(newData, ExtractedDataSchema);
      }

      await updateState({ 
        extractedData: newData,
        errors: { ...state.errors, extractedData: undefined },
      });

      await logger.info('Dados extraídos atualizados', {
        component: 'useAppState',
        action: 'updateExtractedData',
        updatedFields: Object.keys(data),
        validated: validate,
      });
    } catch (error) {
      const validationError = new AppValidationError(
        `Erro na validação dos dados: ${(error as Error).message}`,
        'extractedData',
        data
      );

      await updateState({
        errors: { ...state.errors, extractedData: validationError },
      });

      await logger.error('Erro ao atualizar dados extraídos', validationError, {
        component: 'useAppState',
        action: 'updateExtractedData',
      });

      throw validationError;
    }
  }, [state.extractedData, state.errors, updateState]);

  /**
   * Atualiza configuração
   */
  const updateConfig = useCallback(async (configUpdates: Partial<AppConfig>) => {
    try {
      const newConfig = { ...state.config, ...configUpdates };
      validateData(newConfig, AppConfigSchema);

      await updateState({ 
        config: newConfig,
        errors: { ...state.errors, config: undefined },
      });

      await logger.info('Configuração atualizada', {
        component: 'useAppState',
        action: 'updateConfig',
        updatedKeys: Object.keys(configUpdates),
      });
    } catch (error) {
      const validationError = new AppValidationError(
        `Erro na validação da configuração: ${(error as Error).message}`,
        'config',
        configUpdates
      );

      await updateState({
        errors: { ...state.errors, config: validationError },
      });

      await logger.error('Erro ao atualizar configuração', validationError, {
        component: 'useAppState',
        action: 'updateConfig',
      });

      throw validationError;
    }
  }, [state.config, state.errors, updateState]);

  /**
   * Adiciona arquivo à lista de recentes
   */
  const addRecentFile = useCallback(async (fileName: string, filePath?: string) => {
    const recentFile = {
      name: fileName,
      path: filePath,
      processedAt: new Date(),
    };

    const newRecentFiles = [
      recentFile,
      ...state.recentFiles.filter(f => f.name !== fileName),
    ].slice(0, 10); // Mantém apenas os 10 mais recentes

    await updateState({ recentFiles: newRecentFiles });

    await logger.info('Arquivo adicionado aos recentes', {
      component: 'useAppState',
      action: 'addRecentFile',
      fileName,
      totalRecent: newRecentFiles.length,
    });
  }, [state.recentFiles, updateState]);

  /**
   * Incrementa contador de documentos processados
   */
  const incrementDocumentsProcessed = useCallback(async () => {
    await updateState({
      sessionData: {
        ...state.sessionData,
        documentsProcessed: state.sessionData.documentsProcessed + 1,
      },
    });

    await logger.info('Contador de documentos incrementado', {
      component: 'useAppState',
      action: 'incrementDocumentsProcessed',
      total: state.sessionData.documentsProcessed + 1,
    });
  }, [state.sessionData, updateState]);

  /**
   * Reseta dados extraídos
   */
  const resetExtractedData = useCallback(async () => {
    await updateState({ 
      extractedData: DEFAULT_EXTRACTED_DATA,
      errors: { ...state.errors, extractedData: undefined },
    });

    await logger.info('Dados extraídos resetados', {
      component: 'useAppState',
      action: 'resetExtractedData',
    });
  }, [state.errors, updateState]);

  /**
   * Reseta configuração para padrão
   */
  const resetConfig = useCallback(async () => {
    await updateState({ 
      config: DEFAULT_CONFIG,
      errors: { ...state.errors, config: undefined },
    });

    await logger.info('Configuração resetada', {
      component: 'useAppState',
      action: 'resetConfig',
    });
  }, [state.errors, updateState]);

  /**
   * Limpa todos os dados
   */
  const clearAllData = useCallback(async () => {
    if (persistState) {
      Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
    }

    setState({
      extractedData: DEFAULT_EXTRACTED_DATA,
      config: DEFAULT_CONFIG,
      isLoading: false,
      isDirty: false,
      lastSaved: null,
      errors: {},
      warnings: {},
      recentFiles: [],
      sessionData: {
        startTime: new Date(),
        documentsProcessed: 0,
        lastActivity: new Date(),
      },
    });

    await logger.info('Todos os dados foram limpos', {
      component: 'useAppState',
      action: 'clearAllData',
    });
  }, [persistState]);

  /**
   * Salva manualmente
   */
  const saveManually = useCallback(async () => {
    if (!persistState) return;

    try {
      await saveToStorage(state);
      setState(prev => ({ ...prev, isDirty: false, lastSaved: new Date() }));

      await logger.info('Estado salvo manualmente', {
        component: 'useAppState',
        action: 'saveManually',
      });
    } catch (error) {
      await logger.error('Erro ao salvar manualmente', error as Error, {
        component: 'useAppState',
        action: 'saveManually',
      });
      
      if (onError) {
        onError(error as Error);
      }
    }
  }, [persistState, state, saveToStorage, onError]);

  // Carrega estado inicial
  useEffect(() => {
    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
      loadFromStorage();
    }
  }, [loadFromStorage]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  return {
    // Estado
    ...state,
    
    // Ações
    updateExtractedData,
    updateConfig,
    addRecentFile,
    incrementDocumentsProcessed,
    resetExtractedData,
    resetConfig,
    clearAllData,
    saveManually,
    
    // Utilitários
    hasErrors: Object.keys(state.errors).length > 0,
    hasWarnings: Object.keys(state.warnings).length > 0,
    isConfigValid: !state.errors.config,
    isDataValid: !state.errors.extractedData,
    sessionDuration: Date.now() - state.sessionData.startTime.getTime(),
  };
}
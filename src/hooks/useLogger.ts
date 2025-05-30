/**
 * Hook para integração do sistema de logging com React
 * 
 * Este hook fornece uma interface reativa para o sistema de logging,
 * permitindo capturar logs, filtrar por nível e componente, e
 * integrar com ferramentas de monitoramento.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { logger, LogLevel, LogEntry } from '../utils/logger';

interface UseLoggerOptions {
  component?: string; // Nome do componente para contexto
  autoCapture?: boolean; // Capturar logs automaticamente
  maxLogs?: number; // Máximo de logs a manter
  levels?: LogLevel[]; // Níveis de log a capturar
  onLog?: (entry: LogEntry) => void; // Callback para novos logs
}

interface LoggerState {
  logs: LogEntry[];
  isCapturing: boolean;
  totalLogs: number;
  errorCount: number;
  warningCount: number;
  lastError: LogEntry | null;
}

export function useLogger(options: UseLoggerOptions = {}) {
  const {
    component,
    autoCapture = false,
    maxLogs = 100,
    levels = ['error', 'warn', 'info', 'debug'],
    onLog,
  } = options;

  const [state, setState] = useState<LoggerState>({
    logs: [],
    isCapturing: autoCapture,
    totalLogs: 0,
    errorCount: 0,
    warningCount: 0,
    lastError: null,
  });

  const listenerRef = useRef<((entry: LogEntry) => void) | null>(null);
  const componentRef = useRef(component);

  // Atualizar referência do componente
  useEffect(() => {
    componentRef.current = component;
  }, [component]);

  // Função para adicionar log ao estado
  const addLog = useCallback((entry: LogEntry) => {
    // Filtrar por componente se especificado
    if (componentRef.current && entry.context?.component !== componentRef.current) {
      return;
    }

    // Filtrar por nível
    if (!levels.includes(entry.level)) {
      return;
    }

    setState(prev => {
      const newLogs = [...prev.logs, entry].slice(-maxLogs);
      
      return {
        ...prev,
        logs: newLogs,
        totalLogs: prev.totalLogs + 1,
        errorCount: prev.errorCount + (entry.level === 'error' ? 1 : 0),
        warningCount: prev.warningCount + (entry.level === 'warn' ? 1 : 0),
        lastError: entry.level === 'error' ? entry : prev.lastError,
      };
    });

    onLog?.(entry);
  }, [levels, maxLogs, onLog]);

  // Configurar listener
  useEffect(() => {
    if (state.isCapturing) {
      listenerRef.current = addLog;
      logger.addListener(addLog);
    } else {
      if (listenerRef.current) {
        logger.removeListener(listenerRef.current);
        listenerRef.current = null;
      }
    }

    return () => {
      if (listenerRef.current) {
        logger.removeListener(listenerRef.current);
      }
    };
  }, [state.isCapturing, addLog]);

  // Funções de controle
  const startCapture = useCallback(() => {
    setState(prev => ({ ...prev, isCapturing: true }));
  }, []);

  const stopCapture = useCallback(() => {
    setState(prev => ({ ...prev, isCapturing: false }));
  }, []);

  const clearLogs = useCallback(() => {
    setState(prev => ({
      ...prev,
      logs: [],
      totalLogs: 0,
      errorCount: 0,
      warningCount: 0,
      lastError: null,
    }));
  }, []);

  // Funções de logging com contexto do componente
  const log = useCallback((level: LogLevel, message: string, data?: any) => {
    const context = {
      component: componentRef.current,
      ...data,
    };
    
    logger.log(level, message, context);
  }, []);

  const debug = useCallback((message: string, data?: any) => {
    log('debug', message, data);
  }, [log]);

  const info = useCallback((message: string, data?: any) => {
    log('info', message, data);
  }, [log]);

  const warn = useCallback((message: string, data?: any) => {
    log('warn', message, data);
  }, [log]);

  const error = useCallback((message: string, error?: Error | any) => {
    log('error', message, { error });
  }, [log]);

  // Funções de filtragem
  const getLogsByLevel = useCallback((level: LogLevel) => {
    return state.logs.filter(entry => entry.level === level);
  }, [state.logs]);

  const getLogsByTimeRange = useCallback((start: Date, end: Date) => {
    return state.logs.filter(entry => {
      const logTime = new Date(entry.timestamp);
      return logTime >= start && logTime <= end;
    });
  }, [state.logs]);

  const searchLogs = useCallback((query: string) => {
    const lowerQuery = query.toLowerCase();
    return state.logs.filter(entry => 
      entry.message.toLowerCase().includes(lowerQuery) ||
      JSON.stringify(entry.context || {}).toLowerCase().includes(lowerQuery)
    );
  }, [state.logs]);

  // Função para exportar logs
  const exportLogs = useCallback((format: 'json' | 'csv' = 'json') => {
    if (format === 'json') {
      return JSON.stringify(state.logs, null, 2);
    }
    
    // CSV format
    const headers = ['timestamp', 'level', 'message', 'context'];
    const rows = state.logs.map(entry => [
      entry.timestamp,
      entry.level,
      entry.message,
      JSON.stringify(entry.context || {}),
    ]);
    
    return [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
  }, [state.logs]);

  // Função para baixar logs
  const downloadLogs = useCallback((filename?: string, format: 'json' | 'csv' = 'json') => {
    const content = exportLogs(format);
    const blob = new Blob([content], { 
      type: format === 'json' ? 'application/json' : 'text/csv' 
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `logs-${new Date().toISOString().split('T')[0]}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [exportLogs]);

  return {
    // Estado
    ...state,
    
    // Controle
    startCapture,
    stopCapture,
    clearLogs,
    
    // Logging
    log,
    debug,
    info,
    warn,
    error,
    
    // Filtragem
    getLogsByLevel,
    getLogsByTimeRange,
    searchLogs,
    
    // Exportação
    exportLogs,
    downloadLogs,
  };
}

// Hook simplificado para logging de componente
export function useComponentLogger(componentName: string) {
  return useLogger({ 
    component: componentName,
    autoCapture: true,
    levels: ['error', 'warn', 'info'],
  });
}

// Hook para capturar apenas erros
export function useErrorLogger(onError?: (error: LogEntry) => void) {
  return useLogger({
    autoCapture: true,
    levels: ['error'],
    onLog: onError,
  });
}

// Hook para debugging
export function useDebugLogger(component?: string) {
  return useLogger({
    component,
    autoCapture: process.env.NODE_ENV === 'development',
    levels: ['debug', 'info', 'warn', 'error'],
    maxLogs: 50,
  });
}

// Hook para monitoramento de performance
export function usePerformanceLogger(component?: string) {
  const { info, warn } = useLogger({ component });
  
  const logRender = useCallback((renderTime: number) => {
    if (renderTime > 16) { // > 1 frame (60fps)
      warn(`Render lento detectado: ${renderTime}ms`);
    } else {
      info(`Render: ${renderTime}ms`);
    }
  }, [info, warn]);

  const logInteraction = useCallback((action: string, duration: number) => {
    if (duration > 100) {
      warn(`Interação lenta: ${action} (${duration}ms)`);
    } else {
      info(`Interação: ${action} (${duration}ms)`);
    }
  }, [info, warn]);

  return {
    logRender,
    logInteraction,
  };
}
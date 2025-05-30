/**
 * Sistema de logging estruturado
 * 
 * Este módulo fornece um sistema de logging robusto com diferentes níveis,
 * formatação estruturada e integração com serviços de monitoramento.
 */

import { env } from '../config/env';

/**
 * Níveis de log disponíveis
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * Interface para metadados do log
 */
export interface LogMetadata {
  [key: string]: unknown;
  timestamp?: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  component?: string;
  action?: string;
  duration?: number;
  error?: Error | string;
}

/**
 * Interface para entrada de log estruturada
 */
export interface LogEntry {
  level: LogLevel;
  message: string;
  metadata?: LogMetadata;
  timestamp: string;
}

/**
 * Classe principal do logger
 */
class Logger {
  private currentLevel: LogLevel;
  private isDevelopment: boolean;
  private logBuffer: LogEntry[] = [];
  private maxBufferSize = 1000;

  constructor() {
    this.isDevelopment = env.DEV_MODE;
    this.currentLevel = this.parseLogLevel(env.LOG_LEVEL);
  }

  /**
   * Converte string de nível para enum
   */
  private parseLogLevel(level: string): LogLevel {
    switch (level.toLowerCase()) {
      case 'debug':
        return LogLevel.DEBUG;
      case 'info':
        return LogLevel.INFO;
      case 'warn':
        return LogLevel.WARN;
      case 'error':
        return LogLevel.ERROR;
      default:
        return LogLevel.INFO;
    }
  }

  /**
   * Verifica se o nível deve ser logado
   */
  private shouldLog(level: LogLevel): boolean {
    return level >= this.currentLevel;
  }

  /**
   * Formata timestamp ISO
   */
  private getTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * Formata entrada de log para console
   */
  private formatForConsole(entry: LogEntry): string {
    const levelName = LogLevel[entry.level];
    const timestamp = entry.timestamp;
    const metadata = entry.metadata ? JSON.stringify(entry.metadata, null, 2) : '';
    
    return `[${timestamp}] ${levelName}: ${entry.message}${metadata ? '\n' + metadata : ''}`;
  }

  /**
   * Adiciona entrada ao buffer
   */
  private addToBuffer(entry: LogEntry): void {
    this.logBuffer.push(entry);
    
    // Limita o tamanho do buffer
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer = this.logBuffer.slice(-this.maxBufferSize);
    }
  }

  /**
   * Envia log para console com cores
   */
  private logToConsole(entry: LogEntry): void {
    if (!this.isDevelopment && entry.level < LogLevel.WARN) {
      return;
    }

    const formatted = this.formatForConsole(entry);
    
    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(`🔍 ${formatted}`);
        break;
      case LogLevel.INFO:
        console.info(`ℹ️ ${formatted}`);
        break;
      case LogLevel.WARN:
        console.warn(`⚠️ ${formatted}`);
        break;
      case LogLevel.ERROR:
        console.error(`❌ ${formatted}`);
        break;
    }
  }

  /**
   * Envia log para serviços externos (Sentry, etc.)
   */
  private async logToExternalServices(entry: LogEntry): Promise<void> {
    // Em produção, aqui seria integrado com Sentry ou outro serviço
    if (!this.isDevelopment && entry.level >= LogLevel.ERROR) {
      try {
        // Exemplo de integração com Sentry
        // Sentry.captureException(entry.metadata?.error || new Error(entry.message));
        
        // Por enquanto, apenas armazena no localStorage para análise
        const logs = JSON.parse(localStorage.getItem('error_logs') || '[]');
        logs.push(entry);
        localStorage.setItem('error_logs', JSON.stringify(logs.slice(-100))); // Mantém apenas os últimos 100
      } catch (error) {
        console.error('Falha ao enviar log para serviços externos:', error);
      }
    }
  }

  /**
   * Método principal de logging
   */
  private async log(level: LogLevel, message: string, metadata?: LogMetadata): Promise<void> {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      metadata: {
        ...metadata,
        timestamp: this.getTimestamp(),
      },
      timestamp: this.getTimestamp(),
    };

    this.addToBuffer(entry);
    this.logToConsole(entry);
    await this.logToExternalServices(entry);
  }

  /**
   * Log de debug
   */
  async debug(message: string, metadata?: LogMetadata): Promise<void> {
    await this.log(LogLevel.DEBUG, message, metadata);
  }

  /**
   * Log de informação
   */
  async info(message: string, metadata?: LogMetadata): Promise<void> {
    await this.log(LogLevel.INFO, message, metadata);
  }

  /**
   * Log de aviso
   */
  async warn(message: string, metadata?: LogMetadata): Promise<void> {
    await this.log(LogLevel.WARN, message, metadata);
  }

  /**
   * Log de erro
   */
  async error(message: string, error?: Error | string, metadata?: LogMetadata): Promise<void> {
    const errorMetadata: LogMetadata = {
      ...metadata,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : error,
    };
    
    await this.log(LogLevel.ERROR, message, errorMetadata);
  }

  /**
   * Log de performance
   */
  async performance(action: string, duration: number, metadata?: LogMetadata): Promise<void> {
    await this.info(`Performance: ${action}`, {
      ...metadata,
      action,
      duration,
      component: 'performance',
    });
  }

  /**
   * Log de auditoria
   */
  async audit(action: string, userId?: string, metadata?: LogMetadata): Promise<void> {
    await this.info(`Audit: ${action}`, {
      ...metadata,
      action,
      userId,
      component: 'audit',
    });
  }

  /**
   * Log de segurança
   */
  async security(event: string, metadata?: LogMetadata): Promise<void> {
    await this.warn(`Security: ${event}`, {
      ...metadata,
      component: 'security',
    });
  }

  /**
   * Retorna logs do buffer
   */
  getLogs(level?: LogLevel): LogEntry[] {
    if (level !== undefined) {
      return this.logBuffer.filter(entry => entry.level >= level);
    }
    return [...this.logBuffer];
  }

  /**
   * Limpa o buffer de logs
   */
  clearLogs(): void {
    this.logBuffer = [];
  }

  /**
   * Exporta logs como JSON
   */
  exportLogs(): string {
    return JSON.stringify(this.logBuffer, null, 2);
  }

  /**
   * Define nível de log dinamicamente
   */
  setLevel(level: LogLevel): void {
    this.currentLevel = level;
  }

  /**
   * Retorna estatísticas dos logs
   */
  getStats(): { [key in keyof typeof LogLevel]: number } {
    const stats = {
      DEBUG: 0,
      INFO: 0,
      WARN: 0,
      ERROR: 0,
    };

    this.logBuffer.forEach(entry => {
      const levelName = LogLevel[entry.level] as keyof typeof stats;
      stats[levelName]++;
    });

    return stats;
  }
}

/**
 * Instância singleton do logger
 */
export const logger = new Logger();

/**
 * Decorator para logging automático de métodos
 */
export function LogMethod(component?: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const startTime = performance.now();
      const methodName = `${target.constructor.name}.${propertyName}`;
      
      try {
        await logger.debug(`Iniciando ${methodName}`, {
          component: component || target.constructor.name,
          method: propertyName,
          args: args.length,
        });

        const result = await method.apply(this, args);
        const duration = performance.now() - startTime;

        await logger.performance(methodName, duration, {
          component: component || target.constructor.name,
          method: propertyName,
        });

        return result;
      } catch (error) {
        const duration = performance.now() - startTime;
        
        await logger.error(`Erro em ${methodName}`, error as Error, {
          component: component || target.constructor.name,
          method: propertyName,
          duration,
        });
        
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Utilitário para medir performance de funções
 */
export async function measurePerformance<T>(
  name: string,
  fn: () => Promise<T> | T,
  metadata?: LogMetadata
): Promise<T> {
  const startTime = performance.now();
  
  try {
    const result = await fn();
    const duration = performance.now() - startTime;
    
    await logger.performance(name, duration, metadata);
    
    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    
    await logger.error(`Erro durante ${name}`, error as Error, {
      ...metadata,
      duration,
    });
    
    throw error;
  }
}

/**
 * Utilitário para logging de erros com contexto
 */
export async function logError(
  error: Error | string,
  context: string,
  metadata?: LogMetadata
): Promise<void> {
  await logger.error(`${context}: ${error instanceof Error ? error.message : error}`, error, metadata);
}

/**
 * Utilitário para logging de eventos de usuário
 */
export async function logUserAction(
  action: string,
  userId?: string,
  metadata?: LogMetadata
): Promise<void> {
  await logger.audit(action, userId, {
    ...metadata,
    component: 'user_action',
  });
}

/**
 * Utilitário para logging de API calls
 */
export async function logApiCall(
  endpoint: string,
  method: string,
  status: number,
  duration: number,
  metadata?: LogMetadata
): Promise<void> {
  const level = status >= 400 ? LogLevel.ERROR : LogLevel.INFO;
  const message = `API ${method} ${endpoint} - ${status}`;
  
  await logger.log(level, message, {
    ...metadata,
    component: 'api',
    endpoint,
    method,
    status,
    duration,
  });
}

// Exporta tipos para uso externo
export { LogLevel, LogMetadata, LogEntry };
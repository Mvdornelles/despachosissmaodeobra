/**
 * Sistema centralizado de tratamento de erros
 * 
 * Este módulo fornece classes e utilitários para tratamento consistente
 * de erros em toda a aplicação, com logging automático e recuperação.
 */

import { logger, LogMetadata } from './logger';
import { ValidationError } from '../validators/schemas';

/**
 * Tipos de erro da aplicação
 */
export enum ErrorType {
  VALIDATION = 'VALIDATION',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  NETWORK = 'NETWORK',
  API = 'API',
  FILE_PROCESSING = 'FILE_PROCESSING',
  OCR = 'OCR',
  AI_SERVICE = 'AI_SERVICE',
  DATABASE = 'DATABASE',
  CONFIGURATION = 'CONFIGURATION',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Severidade do erro
 */
export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

/**
 * Interface para contexto do erro
 */
export interface ErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  timestamp?: string;
  userAgent?: string;
  url?: string;
  additionalData?: Record<string, unknown>;
}

/**
 * Interface para estratégia de recuperação
 */
export interface RecoveryStrategy {
  canRecover: boolean;
  retryable: boolean;
  maxRetries?: number;
  retryDelay?: number;
  fallbackAction?: () => Promise<void> | void;
  userMessage?: string;
}

/**
 * Classe base para erros da aplicação
 */
export abstract class AppError extends Error {
  public readonly type: ErrorType;
  public readonly severity: ErrorSeverity;
  public readonly context: ErrorContext;
  public readonly recovery: RecoveryStrategy;
  public readonly timestamp: string;
  public readonly userMessage: string;

  constructor(
    message: string,
    type: ErrorType,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    context: ErrorContext = {},
    recovery: RecoveryStrategy = { canRecover: false, retryable: false },
    userMessage?: string
  ) {
    super(message);
    this.name = this.constructor.name;
    this.type = type;
    this.severity = severity;
    this.context = {
      ...context,
      timestamp: new Date().toISOString(),
    };
    this.recovery = recovery;
    this.timestamp = new Date().toISOString();
    this.userMessage = userMessage || this.getDefaultUserMessage();

    // Captura stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Mensagem padrão para o usuário baseada no tipo de erro
   */
  private getDefaultUserMessage(): string {
    switch (this.type) {
      case ErrorType.VALIDATION:
        return 'Os dados fornecidos são inválidos. Verifique e tente novamente.';
      case ErrorType.AUTHENTICATION:
        return 'Falha na autenticação. Faça login novamente.';
      case ErrorType.AUTHORIZATION:
        return 'Você não tem permissão para realizar esta ação.';
      case ErrorType.NETWORK:
        return 'Problema de conexão. Verifique sua internet e tente novamente.';
      case ErrorType.API:
        return 'Erro no servidor. Tente novamente em alguns instantes.';
      case ErrorType.FILE_PROCESSING:
        return 'Erro ao processar o arquivo. Verifique o formato e tente novamente.';
      case ErrorType.OCR:
        return 'Erro ao extrair texto do documento. Tente com uma imagem mais clara.';
      case ErrorType.AI_SERVICE:
        return 'Erro no serviço de IA. Tente novamente em alguns instantes.';
      case ErrorType.DATABASE:
        return 'Erro no banco de dados. Tente novamente.';
      case ErrorType.CONFIGURATION:
        return 'Erro de configuração do sistema.';
      default:
        return 'Ocorreu um erro inesperado. Tente novamente.';
    }
  }

  /**
   * Converte erro para objeto serializável
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      type: this.type,
      severity: this.severity,
      context: this.context,
      recovery: this.recovery,
      timestamp: this.timestamp,
      userMessage: this.userMessage,
      stack: this.stack,
    };
  }
}

/**
 * Erro de validação
 */
export class AppValidationError extends AppError {
  constructor(
    message: string,
    field?: string,
    context: ErrorContext = {},
    userMessage?: string
  ) {
    super(
      message,
      ErrorType.VALIDATION,
      ErrorSeverity.LOW,
      { ...context, field },
      { canRecover: true, retryable: false },
      userMessage
    );
  }
}

/**
 * Erro de autenticação
 */
export class AppAuthenticationError extends AppError {
  constructor(
    message: string = 'Falha na autenticação',
    context: ErrorContext = {},
    userMessage?: string
  ) {
    super(
      message,
      ErrorType.AUTHENTICATION,
      ErrorSeverity.HIGH,
      context,
      { canRecover: true, retryable: false },
      userMessage
    );
  }
}

/**
 * Erro de autorização
 */
export class AppAuthorizationError extends AppError {
  constructor(
    message: string = 'Acesso negado',
    context: ErrorContext = {},
    userMessage?: string
  ) {
    super(
      message,
      ErrorType.AUTHORIZATION,
      ErrorSeverity.HIGH,
      context,
      { canRecover: false, retryable: false },
      userMessage
    );
  }
}

/**
 * Erro de rede
 */
export class AppNetworkError extends AppError {
  constructor(
    message: string,
    context: ErrorContext = {},
    userMessage?: string
  ) {
    super(
      message,
      ErrorType.NETWORK,
      ErrorSeverity.MEDIUM,
      context,
      { canRecover: true, retryable: true, maxRetries: 3, retryDelay: 1000 },
      userMessage
    );
  }
}

/**
 * Erro de API
 */
export class AppApiError extends AppError {
  public readonly statusCode?: number;
  public readonly endpoint?: string;

  constructor(
    message: string,
    statusCode?: number,
    endpoint?: string,
    context: ErrorContext = {},
    userMessage?: string
  ) {
    const severity = statusCode && statusCode >= 500 
      ? ErrorSeverity.HIGH 
      : ErrorSeverity.MEDIUM;
    
    const retryable = statusCode && (statusCode >= 500 || statusCode === 429);
    
    super(
      message,
      ErrorType.API,
      severity,
      { ...context, statusCode, endpoint },
      { canRecover: true, retryable, maxRetries: retryable ? 3 : 0 },
      userMessage
    );
    
    this.statusCode = statusCode;
    this.endpoint = endpoint;
  }
}

/**
 * Erro de processamento de arquivo
 */
export class AppFileProcessingError extends AppError {
  constructor(
    message: string,
    fileName?: string,
    context: ErrorContext = {},
    userMessage?: string
  ) {
    super(
      message,
      ErrorType.FILE_PROCESSING,
      ErrorSeverity.MEDIUM,
      { ...context, fileName },
      { canRecover: true, retryable: false },
      userMessage
    );
  }
}

/**
 * Erro de OCR
 */
export class AppOCRError extends AppError {
  constructor(
    message: string,
    context: ErrorContext = {},
    userMessage?: string
  ) {
    super(
      message,
      ErrorType.OCR,
      ErrorSeverity.MEDIUM,
      context,
      { canRecover: true, retryable: true, maxRetries: 2 },
      userMessage
    );
  }
}

/**
 * Erro de serviço de IA
 */
export class AppAIServiceError extends AppError {
  constructor(
    message: string,
    service?: string,
    context: ErrorContext = {},
    userMessage?: string
  ) {
    super(
      message,
      ErrorType.AI_SERVICE,
      ErrorSeverity.HIGH,
      { ...context, service },
      { canRecover: true, retryable: true, maxRetries: 2, retryDelay: 2000 },
      userMessage
    );
  }
}

/**
 * Erro de banco de dados
 */
export class AppDatabaseError extends AppError {
  constructor(
    message: string,
    operation?: string,
    context: ErrorContext = {},
    userMessage?: string
  ) {
    super(
      message,
      ErrorType.DATABASE,
      ErrorSeverity.HIGH,
      { ...context, operation },
      { canRecover: true, retryable: true, maxRetries: 2 },
      userMessage
    );
  }
}

/**
 * Erro de configuração
 */
export class AppConfigurationError extends AppError {
  constructor(
    message: string,
    configKey?: string,
    context: ErrorContext = {},
    userMessage?: string
  ) {
    super(
      message,
      ErrorType.CONFIGURATION,
      ErrorSeverity.CRITICAL,
      { ...context, configKey },
      { canRecover: false, retryable: false },
      userMessage || 'Erro de configuração do sistema. Contate o suporte.'
    );
  }
}

/**
 * Classe principal para tratamento de erros
 */
class ErrorHandler {
  private errorListeners: Array<(error: AppError) => void> = [];
  private recoveryAttempts = new Map<string, number>();

  /**
   * Adiciona listener para erros
   */
  addErrorListener(listener: (error: AppError) => void): void {
    this.errorListeners.push(listener);
  }

  /**
   * Remove listener de erros
   */
  removeErrorListener(listener: (error: AppError) => void): void {
    const index = this.errorListeners.indexOf(listener);
    if (index > -1) {
      this.errorListeners.splice(index, 1);
    }
  }

  /**
   * Processa erro e executa estratégias de recuperação
   */
  async handleError(error: Error | AppError, context?: ErrorContext): Promise<AppError> {
    let appError: AppError;

    // Converte erro genérico para AppError
    if (error instanceof AppError) {
      appError = error;
    } else {
      appError = this.convertToAppError(error, context);
    }

    // Adiciona contexto adicional se fornecido
    if (context) {
      appError.context = { ...appError.context, ...context };
    }

    // Log do erro
    await this.logError(appError);

    // Notifica listeners
    this.notifyListeners(appError);

    // Tenta recuperação se possível
    if (appError.recovery.canRecover) {
      await this.attemptRecovery(appError);
    }

    return appError;
  }

  /**
   * Converte erro genérico para AppError
   */
  private convertToAppError(error: Error, context?: ErrorContext): AppError {
    if (error instanceof ValidationError) {
      return new AppValidationError(error.message, error.field, context);
    }

    // Detecta tipo de erro baseado na mensagem ou propriedades
    if (error.message.includes('network') || error.message.includes('fetch')) {
      return new AppNetworkError(error.message, context);
    }

    if (error.message.includes('unauthorized') || error.message.includes('authentication')) {
      return new AppAuthenticationError(error.message, context);
    }

    if (error.message.includes('forbidden') || error.message.includes('permission')) {
      return new AppAuthorizationError(error.message, context);
    }

    // Erro genérico
    return new AppError(
      error.message,
      ErrorType.UNKNOWN,
      ErrorSeverity.MEDIUM,
      context || {},
      { canRecover: false, retryable: false },
      'Ocorreu um erro inesperado'
    );
  }

  /**
   * Faz log do erro
   */
  private async logError(error: AppError): Promise<void> {
    const metadata: LogMetadata = {
      errorType: error.type,
      severity: error.severity,
      context: error.context,
      recovery: error.recovery,
      userMessage: error.userMessage,
    };

    switch (error.severity) {
      case ErrorSeverity.LOW:
        await logger.warn(error.message, metadata);
        break;
      case ErrorSeverity.MEDIUM:
        await logger.error(error.message, error, metadata);
        break;
      case ErrorSeverity.HIGH:
      case ErrorSeverity.CRITICAL:
        await logger.error(error.message, error, metadata);
        // Em produção, aqui seria enviado para Sentry ou similar
        break;
    }
  }

  /**
   * Notifica listeners sobre o erro
   */
  private notifyListeners(error: AppError): void {
    this.errorListeners.forEach(listener => {
      try {
        listener(error);
      } catch (listenerError) {
        console.error('Erro no listener de erro:', listenerError);
      }
    });
  }

  /**
   * Tenta recuperação do erro
   */
  private async attemptRecovery(error: AppError): Promise<void> {
    const errorKey = `${error.type}-${error.context.component}-${error.context.action}`;
    const attempts = this.recoveryAttempts.get(errorKey) || 0;

    if (error.recovery.retryable && error.recovery.maxRetries && attempts < error.recovery.maxRetries) {
      this.recoveryAttempts.set(errorKey, attempts + 1);
      
      if (error.recovery.retryDelay) {
        await new Promise(resolve => setTimeout(resolve, error.recovery.retryDelay));
      }

      await logger.info(`Tentativa de recuperação ${attempts + 1}/${error.recovery.maxRetries}`, {
        errorType: error.type,
        component: error.context.component,
        action: error.context.action,
      });
    }

    if (error.recovery.fallbackAction) {
      try {
        await error.recovery.fallbackAction();
        await logger.info('Ação de fallback executada com sucesso', {
          errorType: error.type,
          component: error.context.component,
        });
      } catch (fallbackError) {
        await logger.error('Falha na ação de fallback', fallbackError as Error);
      }
    }
  }

  /**
   * Limpa tentativas de recuperação
   */
  clearRecoveryAttempts(errorKey?: string): void {
    if (errorKey) {
      this.recoveryAttempts.delete(errorKey);
    } else {
      this.recoveryAttempts.clear();
    }
  }

  /**
   * Retorna estatísticas de erros
   */
  getErrorStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    
    Object.values(ErrorType).forEach(type => {
      stats[type] = 0;
    });

    // Em uma implementação real, isso viria de um store de erros
    return stats;
  }
}

/**
 * Instância singleton do error handler
 */
export const errorHandler = new ErrorHandler();

/**
 * Decorator para tratamento automático de erros em métodos
 */
export function HandleErrors(context?: Partial<ErrorContext>) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      try {
        return await method.apply(this, args);
      } catch (error) {
        const errorContext: ErrorContext = {
          component: target.constructor.name,
          action: propertyName,
          ...context,
        };

        const handledError = await errorHandler.handleError(error as Error, errorContext);
        throw handledError;
      }
    };

    return descriptor;
  };
}

/**
 * Utilitário para executar função com tratamento de erro
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T> | T,
  context?: ErrorContext
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const handledError = await errorHandler.handleError(error as Error, context);
    throw handledError;
  }
}

/**
 * Utilitário para retry com backoff exponencial
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
  context?: ErrorContext
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        break;
      }
      
      const delay = baseDelay * Math.pow(2, attempt);
      await logger.warn(`Tentativa ${attempt + 1}/${maxRetries + 1} falhou, tentando novamente em ${delay}ms`, {
        error: error as Error,
        attempt: attempt + 1,
        maxRetries: maxRetries + 1,
        delay,
        ...context,
      });
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw await errorHandler.handleError(lastError!, context);
}

// Exporta todas as classes de erro
export {
  AppError,
  AppValidationError,
  AppAuthenticationError,
  AppAuthorizationError,
  AppNetworkError,
  AppApiError,
  AppFileProcessingError,
  AppOCRError,
  AppAIServiceError,
  AppDatabaseError,
  AppConfigurationError,
};
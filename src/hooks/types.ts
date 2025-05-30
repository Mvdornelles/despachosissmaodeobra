/**
 * Tipos TypeScript para hooks personalizados
 * 
 * Este módulo define todas as interfaces e tipos utilizados
 * pelos hooks personalizados da aplicação.
 */

import { User } from '@supabase/supabase-js';
import { ExtractedData, StatusMessage, UploadProgress } from '../validators/schemas';
import { AppError } from '../utils/errorHandler';

/**
 * Estado de autenticação
 */
export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: AppError | null;
}

/**
 * Dados da sessão
 */
export interface SessionData {
  id: string;
  userId: string;
  createdAt: string;
  lastActivity: string;
  metadata?: Record<string, unknown>;
}

/**
 * Estado de API
 */
export interface ApiState<T = unknown> {
  data: T | null;
  isLoading: boolean;
  error: AppError | null;
  lastFetch: Date | null;
}

/**
 * Estado de operação assíncrona
 */
export interface AsyncOperationState<T = unknown> {
  data: T | null;
  isLoading: boolean;
  error: AppError | null;
  isSuccess: boolean;
  isError: boolean;
  reset: () => void;
  execute: (...args: any[]) => Promise<T>;
}

/**
 * Estado do modal
 */
export interface ModalState {
  isOpen: boolean;
  title?: string;
  content?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  closable?: boolean;
  onClose?: () => void;
}

/**
 * Estado do toast
 */
export interface ToastState {
  toasts: ToastItem[];
  addToast: (toast: Omit<ToastItem, 'id' | 'timestamp'>) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

/**
 * Item de toast
 */
export interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  timestamp: Date;
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Estado de upload de arquivo
 */
export interface FileUploadState {
  files: FileUploadItem[];
  isUploading: boolean;
  progress: number;
  error: AppError | null;
  uploadFile: (file: File, options?: FileUploadOptions) => Promise<string>;
  removeFile: (id: string) => void;
  clearFiles: () => void;
}

/**
 * Item de upload de arquivo
 */
export interface FileUploadItem {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  url?: string;
  error?: AppError;
}

/**
 * Opções de upload de arquivo
 */
export interface FileUploadOptions {
  maxSize?: number;
  allowedTypes?: string[];
  onProgress?: (progress: number) => void;
  onComplete?: (url: string) => void;
  onError?: (error: AppError) => void;
}

/**
 * Estado de validação
 */
export interface ValidationState<T = Record<string, unknown>> {
  values: T;
  errors: Record<keyof T, string>;
  touched: Record<keyof T, boolean>;
  isValid: boolean;
  isValidating: boolean;
  setValue: (field: keyof T, value: any) => void;
  setError: (field: keyof T, error: string) => void;
  setTouched: (field: keyof T, touched: boolean) => void;
  validate: (field?: keyof T) => Promise<boolean>;
  reset: () => void;
}

/**
 * Regra de validação
 */
export interface ValidationRule<T = any> {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: T) => string | null;
  asyncValidator?: (value: T) => Promise<string | null>;
}

/**
 * Métricas de performance
 */
export interface PerformanceMetrics {
  renderTime: number;
  componentCount: number;
  memoryUsage?: number;
  networkRequests: number;
  errors: number;
  warnings: number;
}

/**
 * Estado de dados extraídos
 */
export interface ExtractedDataState {
  data: ExtractedData | null;
  isLoading: boolean;
  error: AppError | null;
  progress: UploadProgress | null;
  setData: (data: ExtractedData) => void;
  updateField: (field: keyof ExtractedData, value: string) => void;
  clearData: () => void;
  validateData: () => boolean;
}

/**
 * Estado de processamento de documento
 */
export interface DocumentProcessingState {
  stage: 'idle' | 'uploading' | 'processing' | 'extracting' | 'analyzing' | 'completed' | 'error';
  progress: number;
  message: string;
  error: AppError | null;
  result: ExtractedData | null;
  processDocument: (file: File, additionalInfo?: string) => Promise<ExtractedData>;
  reset: () => void;
}

/**
 * Configurações de retry
 */
export interface RetryConfig {
  maxAttempts: number;
  delay: number;
  backoff?: 'linear' | 'exponential';
  retryCondition?: (error: AppError) => boolean;
}

/**
 * Estado de retry
 */
export interface RetryState<T = unknown> {
  attempt: number;
  maxAttempts: number;
  isRetrying: boolean;
  lastError: AppError | null;
  execute: () => Promise<T>;
  reset: () => void;
}

/**
 * Configurações de debounce
 */
export interface DebounceConfig {
  delay: number;
  immediate?: boolean;
}

/**
 * Configurações de throttle
 */
export interface ThrottleConfig {
  delay: number;
  leading?: boolean;
  trailing?: boolean;
}

/**
 * Estado de clipboard
 */
export interface ClipboardState {
  value: string | null;
  isSupported: boolean;
  copy: (text: string) => Promise<boolean>;
  paste: () => Promise<string | null>;
}

/**
 * Configurações de teclado
 */
export interface KeyboardConfig {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
  preventDefault?: boolean;
  stopPropagation?: boolean;
}

/**
 * Estado de armazenamento local
 */
export interface StorageState<T> {
  value: T | null;
  setValue: (value: T) => void;
  removeValue: () => void;
  isLoading: boolean;
  error: AppError | null;
}

/**
 * Configurações de API
 */
export interface ApiConfig {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  retries?: number;
  cache?: boolean;
  cacheTime?: number;
}

/**
 * Estado de leitor de arquivo
 */
export interface FileReaderState {
  content: string | ArrayBuffer | null;
  isReading: boolean;
  error: AppError | null;
  progress: number;
  readAsText: (file: File, encoding?: string) => Promise<string>;
  readAsDataURL: (file: File) => Promise<string>;
  readAsArrayBuffer: (file: File) => Promise<ArrayBuffer>;
  reset: () => void;
}

/**
 * Configurações de modal
 */
export interface ModalConfig {
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  closable?: boolean;
  backdrop?: boolean;
  keyboard?: boolean;
  centered?: boolean;
  scrollable?: boolean;
}

/**
 * Configurações de logger
 */
export interface LoggerConfig {
  component?: string;
  enablePerformance?: boolean;
  enableUserActions?: boolean;
  enableErrors?: boolean;
}

/**
 * Estado de logger
 */
export interface LoggerState {
  logs: LogEntry[];
  isEnabled: boolean;
  logLevel: string;
  clearLogs: () => void;
  exportLogs: () => string;
  setLevel: (level: string) => void;
}

/**
 * Entrada de log
 */
export interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  component?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Estado de tratamento de erro
 */
export interface ErrorHandlerState {
  errors: AppError[];
  lastError: AppError | null;
  handleError: (error: Error | AppError, context?: Record<string, unknown>) => Promise<AppError>;
  clearErrors: () => void;
  retryLastOperation: () => Promise<void>;
}

/**
 * Configurações de performance
 */
export interface PerformanceConfig {
  enableMetrics?: boolean;
  enableProfiling?: boolean;
  sampleRate?: number;
  thresholds?: {
    renderTime?: number;
    memoryUsage?: number;
    networkTime?: number;
  };
}

/**
 * Estado de performance
 */
export interface PerformanceState {
  metrics: PerformanceMetrics;
  isMonitoring: boolean;
  startMonitoring: () => void;
  stopMonitoring: () => void;
  getReport: () => PerformanceReport;
  clearMetrics: () => void;
}

/**
 * Relatório de performance
 */
export interface PerformanceReport {
  summary: {
    averageRenderTime: number;
    totalComponents: number;
    totalErrors: number;
    totalWarnings: number;
  };
  details: PerformanceMetrics[];
  recommendations: string[];
}

/**
 * Configurações de callback memoizado
 */
export interface MemoizedCallbackConfig {
  deps?: React.DependencyList;
  debounce?: number;
  throttle?: number;
}

/**
 * Estado de click outside
 */
export interface ClickOutsideState {
  ref: React.RefObject<HTMLElement>;
  isOutside: boolean;
}

/**
 * Configurações de validação de campo
 */
export interface FieldValidationConfig<T = any> {
  rules: ValidationRule<T>[];
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  debounceMs?: number;
}

/**
 * Estado de validação de campo
 */
export interface FieldValidationState<T = any> {
  value: T;
  error: string | null;
  isValid: boolean;
  isValidating: boolean;
  isTouched: boolean;
  setValue: (value: T) => void;
  validate: () => Promise<boolean>;
  reset: () => void;
}
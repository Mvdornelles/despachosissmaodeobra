/**
 * Hooks personalizados da aplicação
 * 
 * Este módulo exporta todos os hooks personalizados para uso
 * consistente em toda a aplicação React.
 */

// Hooks de autenticação
export { useAuth } from './useAuth';
export { useSession } from './useSession';

// Hooks de estado
export { useLocalStorage } from './useLocalStorage';
export { useSessionStorage } from './useSessionStorage';

// Hooks de utilidade
export { 
  useDebounce, 
  useSimpleDebounce, 
  useDebouncedCallback, 
  useSearchDebounce, 
  useValidationDebounce 
} from './useDebounce';
export { 
  useThrottle, 
  useSimpleThrottle, 
  useThrottledCallback, 
  useScrollThrottle, 
  useResizeThrottle, 
  useMouseMoveThrottle, 
  useApiThrottle 
} from './useThrottle';

// Hooks de API
export { useApi } from './useApi';
export { useAsyncOperation } from './useAsyncOperation';
export { useRetry } from './useRetry';

// Hooks de UI
export { useModal } from './useModal';
export { useToast } from './useToast';
export { useClipboard } from './useClipboard';
export { useKeyboard } from './useKeyboard';
export { useClickOutside } from './useClickOutside';

// Hooks de arquivo
export { useFileUpload } from './useFileUpload';
export { useFileReader } from './useFileReader';

// Hooks de validação
export { useFormValidation } from './useFormValidation';
export { useFieldValidation } from './useFieldValidation';

// Hooks de performance
export { usePerformance } from './usePerformance';
export { useMemoizedCallback } from './useMemoizedCallback';

// Hooks de logging
export { 
  useLogger, 
  useComponentLogger, 
  useErrorLogger, 
  useDebugLogger, 
  usePerformanceLogger 
} from './useLogger';
export { 
  useErrorHandler, 
  useComponentErrorHandler, 
  useCriticalErrorHandler, 
  useFormErrorHandler, 
  useApiErrorHandler 
} from './useErrorHandler';

// Hooks de dados
export { 
  useExtractedData, 
  useFieldEditor 
} from './useExtractedData';
export { useDocumentProcessing } from './useDocumentProcessing';

// Tipos
export type {
  AuthState,
  SessionData,
  ApiState,
  AsyncOperationState,
  ModalState,
  ToastState,
  FileUploadState,
  ValidationState,
  PerformanceMetrics,
  ExtractedDataState,
  DocumentProcessingState,
} from './types';
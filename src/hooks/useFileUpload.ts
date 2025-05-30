/**
 * Hook para gerenciamento de upload de arquivos
 * 
 * Este hook fornece funcionalidades completas para upload de arquivos,
 * incluindo validação, progresso, preview e tratamento de erros.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { logger } from '../utils/logger';
import { errorHandler, AppFileProcessingError, AppValidationError } from '../utils/errorHandler';
import { validateData, FileUploadSchema } from '../validators/schemas';
import { FileUploadState, UploadProgress, FileValidationConfig } from './types';

/**
 * Configuração do upload
 */
interface FileUploadConfig {
  maxFileSize?: number;
  allowedTypes?: string[];
  maxFiles?: number;
  autoUpload?: boolean;
  enablePreview?: boolean;
  enableValidation?: boolean;
  onProgress?: (progress: UploadProgress) => void;
  onSuccess?: (files: File[]) => void;
  onError?: (error: Error) => void;
  onFileAdded?: (file: File) => void;
  onFileRemoved?: (file: File) => void;
}

/**
 * Informações do arquivo
 */
interface FileInfo {
  file: File;
  id: string;
  preview?: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
  uploadedAt?: Date;
}

/**
 * Resultado da validação
 */
interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Hook de upload de arquivos
 */
export function useFileUpload(config: FileUploadConfig = {}) {
  const {
    maxFileSize = 10 * 1024 * 1024, // 10MB
    allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
    maxFiles = 1,
    autoUpload = false,
    enablePreview = true,
    enableValidation = true,
    onProgress,
    onSuccess,
    onError,
    onFileAdded,
    onFileRemoved,
  } = config;

  // Estado do upload
  const [state, setState] = useState<FileUploadState>({
    files: [],
    isUploading: false,
    progress: 0,
    error: null,
    isDragOver: false,
  });

  // Referências
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());

  /**
   * Gera ID único para arquivo
   */
  const generateFileId = useCallback((): string => {
    return `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  /**
   * Atualiza estado de forma segura
   */
  const updateState = useCallback((updates: Partial<FileUploadState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  /**
   * Valida um arquivo
   */
  const validateFile = useCallback(async (file: File): Promise<ValidationResult> => {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      await logger.debug('Validando arquivo', {
        component: 'useFileUpload',
        action: 'validateFile',
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
      });

      // Validação básica com schema
      if (enableValidation) {
        try {
          validateData(
            {
              file,
              type: file.type.includes('pdf') ? 'pdf' : 'image',
              size: file.size,
            },
            FileUploadSchema
          );
        } catch (error) {
          errors.push(`Erro de validação: ${(error as Error).message}`);
        }
      }

      // Validação de tamanho
      if (file.size > maxFileSize) {
        errors.push(`Arquivo muito grande. Tamanho máximo: ${(maxFileSize / 1024 / 1024).toFixed(1)}MB`);
      }

      // Validação de tipo
      if (!allowedTypes.includes(file.type)) {
        errors.push(`Tipo de arquivo não suportado. Tipos aceitos: ${allowedTypes.join(', ')}`);
      }

      // Validação de nome
      if (file.name.length > 255) {
        errors.push('Nome do arquivo muito longo (máximo 255 caracteres)');
      }

      // Caracteres especiais no nome
      const invalidChars = /[<>:"/\\|?*]/;
      if (invalidChars.test(file.name)) {
        warnings.push('Nome do arquivo contém caracteres especiais que podem causar problemas');
      }

      // Arquivo muito pequeno
      if (file.size < 100) {
        warnings.push('Arquivo muito pequeno, pode estar corrompido');
      }

      const result = {
        isValid: errors.length === 0,
        errors,
        warnings,
      };

      await logger.info('Validação de arquivo concluída', {
        component: 'useFileUpload',
        action: 'validateFile',
        fileName: file.name,
        isValid: result.isValid,
        errorCount: errors.length,
        warningCount: warnings.length,
      });

      return result;
    } catch (error) {
      await logger.error('Erro na validação do arquivo', error as Error, {
        component: 'useFileUpload',
        action: 'validateFile',
        fileName: file.name,
      });

      return {
        isValid: false,
        errors: [`Erro interno na validação: ${(error as Error).message}`],
        warnings: [],
      };
    }
  }, [maxFileSize, allowedTypes, enableValidation]);

  /**
   * Cria preview do arquivo
   */
  const createPreview = useCallback(async (file: File): Promise<string | undefined> => {
    if (!enablePreview || !file.type.startsWith('image/')) {
      return undefined;
    }

    try {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = () => {
          resolve(reader.result as string);
        };
        
        reader.onerror = () => {
          reject(new Error('Erro ao criar preview do arquivo'));
        };
        
        reader.readAsDataURL(file);
      });
    } catch (error) {
      await logger.warn('Erro ao criar preview', {
        component: 'useFileUpload',
        action: 'createPreview',
        fileName: file.name,
        error: (error as Error).message,
      });
      
      return undefined;
    }
  }, [enablePreview]);

  /**
   * Adiciona arquivos
   */
  const addFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    
    try {
      await logger.info('Adicionando arquivos', {
        component: 'useFileUpload',
        action: 'addFiles',
        fileCount: fileArray.length,
      });

      // Verifica limite de arquivos
      if (state.files.length + fileArray.length > maxFiles) {
        throw new AppValidationError(
          `Limite de arquivos excedido. Máximo: ${maxFiles}`,
          'fileCount',
          { current: state.files.length, adding: fileArray.length, max: maxFiles }
        );
      }

      const newFiles: FileInfo[] = [];

      for (const file of fileArray) {
        // Valida arquivo
        const validation = await validateFile(file);
        
        if (!validation.isValid) {
          throw new AppFileProcessingError(
            `Arquivo inválido: ${validation.errors.join(', ')}`,
            file.name
          );
        }

        // Cria preview se necessário
        const preview = await createPreview(file);

        // Cria info do arquivo
        const fileInfo: FileInfo = {
          file,
          id: generateFileId(),
          preview,
          progress: 0,
          status: 'pending',
        };

        newFiles.push(fileInfo);

        // Callback de arquivo adicionado
        if (onFileAdded) {
          onFileAdded(file);
        }

        // Log de warnings se houver
        if (validation.warnings.length > 0) {
          await logger.warn('Arquivo adicionado com avisos', {
            component: 'useFileUpload',
            action: 'addFiles',
            fileName: file.name,
            warnings: validation.warnings,
          });
        }
      }

      // Atualiza estado
      updateState({
        files: [...state.files, ...newFiles],
        error: null,
      });

      await logger.info('Arquivos adicionados com sucesso', {
        component: 'useFileUpload',
        action: 'addFiles',
        addedCount: newFiles.length,
        totalFiles: state.files.length + newFiles.length,
      });

      // Auto-upload se habilitado
      if (autoUpload) {
        await uploadFiles();
      }
    } catch (error) {
      const handledError = await errorHandler.handleError(error as Error, {
        component: 'useFileUpload',
        action: 'addFiles',
      });

      updateState({ error: handledError });

      if (onError) {
        onError(handledError);
      }

      throw handledError;
    }
  }, [state.files, maxFiles, validateFile, createPreview, generateFileId, onFileAdded, autoUpload, updateState, onError]);

  /**
   * Remove arquivo
   */
  const removeFile = useCallback(async (fileId: string) => {
    const fileInfo = state.files.find(f => f.id === fileId);
    
    if (!fileInfo) {
      await logger.warn('Tentativa de remover arquivo inexistente', {
        component: 'useFileUpload',
        action: 'removeFile',
        fileId,
      });
      return;
    }

    // Cancela upload se estiver em andamento
    const abortController = abortControllersRef.current.get(fileId);
    if (abortController) {
      abortController.abort();
      abortControllersRef.current.delete(fileId);
    }

    // Remove do estado
    updateState({
      files: state.files.filter(f => f.id !== fileId),
    });

    // Callback de arquivo removido
    if (onFileRemoved) {
      onFileRemoved(fileInfo.file);
    }

    await logger.info('Arquivo removido', {
      component: 'useFileUpload',
      action: 'removeFile',
      fileName: fileInfo.file.name,
      fileId,
    });
  }, [state.files, onFileRemoved, updateState]);

  /**
   * Limpa todos os arquivos
   */
  const clearFiles = useCallback(async () => {
    // Cancela todos os uploads em andamento
    abortControllersRef.current.forEach(controller => controller.abort());
    abortControllersRef.current.clear();

    // Callbacks de arquivos removidos
    if (onFileRemoved) {
      state.files.forEach(fileInfo => onFileRemoved(fileInfo.file));
    }

    updateState({
      files: [],
      isUploading: false,
      progress: 0,
      error: null,
    });

    await logger.info('Todos os arquivos foram removidos', {
      component: 'useFileUpload',
      action: 'clearFiles',
      removedCount: state.files.length,
    });
  }, [state.files, onFileRemoved, updateState]);

  /**
   * Simula upload de arquivos
   */
  const uploadFiles = useCallback(async () => {
    const pendingFiles = state.files.filter(f => f.status === 'pending');
    
    if (pendingFiles.length === 0) {
      await logger.warn('Nenhum arquivo pendente para upload', {
        component: 'useFileUpload',
        action: 'uploadFiles',
      });
      return;
    }

    try {
      updateState({ isUploading: true, error: null });

      await logger.info('Iniciando upload de arquivos', {
        component: 'useFileUpload',
        action: 'uploadFiles',
        fileCount: pendingFiles.length,
      });

      for (let i = 0; i < pendingFiles.length; i++) {
        const fileInfo = pendingFiles[i];
        const abortController = new AbortController();
        abortControllersRef.current.set(fileInfo.id, abortController);

        try {
          // Atualiza status para uploading
          setState(prev => ({
            ...prev,
            files: prev.files.map(f => 
              f.id === fileInfo.id 
                ? { ...f, status: 'uploading' as const }
                : f
            ),
          }));

          // Simula upload com progresso
          for (let progress = 0; progress <= 100; progress += 10) {
            if (abortController.signal.aborted) {
              throw new Error('Upload cancelado');
            }

            // Atualiza progresso do arquivo
            setState(prev => ({
              ...prev,
              files: prev.files.map(f => 
                f.id === fileInfo.id 
                  ? { ...f, progress }
                  : f
              ),
            }));

            // Atualiza progresso geral
            const overallProgress = ((i * 100) + progress) / pendingFiles.length;
            updateState({ progress: overallProgress });

            // Callback de progresso
            if (onProgress) {
              onProgress({
                stage: 'uploading',
                progress: overallProgress,
                message: `Enviando ${fileInfo.file.name}... ${progress}%`,
              });
            }

            // Simula delay
            await new Promise(resolve => setTimeout(resolve, 100));
          }

          // Marca como concluído
          setState(prev => ({
            ...prev,
            files: prev.files.map(f => 
              f.id === fileInfo.id 
                ? { 
                    ...f, 
                    status: 'completed' as const, 
                    progress: 100,
                    uploadedAt: new Date(),
                  }
                : f
            ),
          }));

          abortControllersRef.current.delete(fileInfo.id);

          await logger.info('Arquivo enviado com sucesso', {
            component: 'useFileUpload',
            action: 'uploadFiles',
            fileName: fileInfo.file.name,
            fileSize: fileInfo.file.size,
          });
        } catch (error) {
          // Marca arquivo com erro
          setState(prev => ({
            ...prev,
            files: prev.files.map(f => 
              f.id === fileInfo.id 
                ? { 
                    ...f, 
                    status: 'error' as const,
                    error: (error as Error).message,
                  }
                : f
            ),
          }));

          abortControllersRef.current.delete(fileInfo.id);

          await logger.error('Erro no upload do arquivo', error as Error, {
            component: 'useFileUpload',
            action: 'uploadFiles',
            fileName: fileInfo.file.name,
          });
        }
      }

      const completedFiles = state.files
        .filter(f => f.status === 'completed')
        .map(f => f.file);

      updateState({ 
        isUploading: false,
        progress: 100,
      });

      // Callback de sucesso
      if (onSuccess && completedFiles.length > 0) {
        onSuccess(completedFiles);
      }

      await logger.info('Upload concluído', {
        component: 'useFileUpload',
        action: 'uploadFiles',
        totalFiles: pendingFiles.length,
        successCount: completedFiles.length,
      });
    } catch (error) {
      const handledError = await errorHandler.handleError(error as Error, {
        component: 'useFileUpload',
        action: 'uploadFiles',
      });

      updateState({ 
        isUploading: false,
        error: handledError,
      });

      if (onError) {
        onError(handledError);
      }

      throw handledError;
    }
  }, [state.files, onProgress, onSuccess, onError, updateState]);

  /**
   * Abre seletor de arquivos
   */
  const openFileSelector = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, []);

  /**
   * Handlers para drag and drop
   */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    updateState({ isDragOver: true });
  }, [updateState]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    updateState({ isDragOver: false });
  }, [updateState]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    updateState({ isDragOver: false });
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await addFiles(files);
    }
  }, [addFiles, updateState]);

  /**
   * Handler para input de arquivo
   */
  const handleFileInputChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await addFiles(files);
    }
    
    // Limpa o input para permitir selecionar o mesmo arquivo novamente
    e.target.value = '';
  }, [addFiles]);

  // Cleanup no unmount
  useEffect(() => {
    return () => {
      // Cancela todos os uploads em andamento
      abortControllersRef.current.forEach(controller => controller.abort());
      abortControllersRef.current.clear();
    };
  }, []);

  return {
    // Estado
    ...state,
    
    // Ações
    addFiles,
    removeFile,
    clearFiles,
    uploadFiles,
    openFileSelector,
    
    // Handlers para drag and drop
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFileInputChange,
    
    // Referência para input
    fileInputRef,
    
    // Utilitários
    hasFiles: state.files.length > 0,
    canAddMore: state.files.length < maxFiles,
    pendingFiles: state.files.filter(f => f.status === 'pending'),
    completedFiles: state.files.filter(f => f.status === 'completed'),
    errorFiles: state.files.filter(f => f.status === 'error'),
    uploadingFiles: state.files.filter(f => f.status === 'uploading'),
    totalSize: state.files.reduce((total, f) => total + f.file.size, 0),
    canUpload: state.files.some(f => f.status === 'pending') && !state.isUploading,
  };
}
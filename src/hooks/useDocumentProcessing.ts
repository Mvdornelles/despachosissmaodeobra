/**
 * Hook para processamento de documentos
 * 
 * Este hook gerencia todo o fluxo de processamento de documentos,
 * incluindo upload, OCR, extração de dados e análise com IA.
 */

import { useState, useCallback, useRef } from 'react';
import { analyzeDocumentText, generateDispatchDocument } from '../../services/geminiService';
import { logger } from '../utils/logger';
import { errorHandler, AppFileProcessingError, AppOCRError, AppAIServiceError } from '../utils/errorHandler';
import { validateData, ExtractedDataSchema, FileUploadSchema } from '../validators/schemas';
import { DocumentProcessingState, UploadProgress } from './types';
import { ExtractedData } from '../validators/schemas';

/**
 * Configurações do processamento de documento
 */
interface DocumentProcessingConfig {
  maxFileSize?: number;
  allowedTypes?: string[];
  enableOCR?: boolean;
  enableAI?: boolean;
  autoValidate?: boolean;
  onProgress?: (progress: UploadProgress) => void;
  onStageChange?: (stage: DocumentProcessingState['stage']) => void;
}

/**
 * Resultado do OCR
 */
interface OCRResult {
  text: string;
  confidence: number;
  words?: Array<{
    text: string;
    confidence: number;
    bbox: {
      x0: number;
      y0: number;
      x1: number;
      y1: number;
    };
  }>;
}

/**
 * Hook de processamento de documentos
 */
export function useDocumentProcessing(config: DocumentProcessingConfig = {}) {
  const {
    maxFileSize = 10 * 1024 * 1024, // 10MB
    allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
    enableOCR = true,
    enableAI = true,
    autoValidate = true,
    onProgress,
    onStageChange,
  } = config;

  // Estado do processamento
  const [state, setState] = useState<DocumentProcessingState>({
    stage: 'idle',
    progress: 0,
    message: 'Aguardando documento...',
    error: null,
    result: null,
    processDocument: async () => ({} as ExtractedData),
    reset: () => {},
  });

  // Referência para cancelamento
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Atualiza o estado do processamento
   */
  const updateState = useCallback((updates: Partial<DocumentProcessingState>) => {
    setState(prev => {
      const newState = { ...prev, ...updates };
      
      // Notifica mudança de estágio
      if (updates.stage && updates.stage !== prev.stage && onStageChange) {
        onStageChange(updates.stage);
      }
      
      // Notifica progresso
      if (updates.progress !== undefined && onProgress) {
        onProgress({
          stage: newState.stage as any,
          progress: updates.progress,
          message: updates.message || prev.message,
          error: updates.error?.message,
        });
      }
      
      return newState;
    });
  }, [onProgress, onStageChange]);

  /**
   * Valida arquivo antes do processamento
   */
  const validateFile = useCallback(async (file: File): Promise<void> => {
    try {
      await logger.debug('Validando arquivo', {
        component: 'useDocumentProcessing',
        action: 'validateFile',
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
      });

      // Valida usando schema
      validateData(
        {
          file,
          type: file.type.includes('pdf') ? 'pdf' : 'image',
          size: file.size,
        },
        FileUploadSchema
      );

      // Validações adicionais
      if (file.size > maxFileSize) {
        throw new AppFileProcessingError(
          `Arquivo muito grande. Tamanho máximo: ${maxFileSize / 1024 / 1024}MB`,
          file.name
        );
      }

      if (!allowedTypes.includes(file.type)) {
        throw new AppFileProcessingError(
          `Tipo de arquivo não suportado. Tipos aceitos: ${allowedTypes.join(', ')}`,
          file.name
        );
      }

      await logger.info('Arquivo validado com sucesso', {
        component: 'useDocumentProcessing',
        action: 'validateFile',
        fileName: file.name,
      });
    } catch (error) {
      await logger.error('Erro na validação do arquivo', error as Error, {
        component: 'useDocumentProcessing',
        action: 'validateFile',
        fileName: file.name,
      });
      throw error;
    }
  }, [maxFileSize, allowedTypes]);

  /**
   * Converte arquivo para base64
   */
  const fileToBase64 = useCallback(async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]); // Remove o prefixo data:type;base64,
      };
      
      reader.onerror = () => {
        reject(new AppFileProcessingError('Erro ao ler arquivo', file.name));
      };
      
      reader.readAsDataURL(file);
    });
  }, []);

  /**
   * Simula OCR (em uma implementação real, seria integrado com serviço de OCR)
   */
  const performOCR = useCallback(async (file: File): Promise<OCRResult> => {
    try {
      await logger.debug('Iniciando OCR', {
        component: 'useDocumentProcessing',
        action: 'performOCR',
        fileName: file.name,
      });

      // Simula processamento OCR
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Em uma implementação real, aqui seria feita a chamada para o serviço de OCR
      // Por exemplo: Tesseract.js, Google Vision API, AWS Textract, etc.
      
      const mockOCRResult: OCRResult = {
        text: `Documento extraído de ${file.name}\n\nEste é um texto simulado do OCR.\nEm uma implementação real, aqui estaria o texto extraído do documento.`,
        confidence: 85,
        words: [
          {
            text: 'Documento',
            confidence: 90,
            bbox: { x0: 10, y0: 10, x1: 100, y1: 30 },
          },
          {
            text: 'extraído',
            confidence: 88,
            bbox: { x0: 110, y0: 10, x1: 180, y1: 30 },
          },
        ],
      };

      await logger.info('OCR concluído', {
        component: 'useDocumentProcessing',
        action: 'performOCR',
        fileName: file.name,
        confidence: mockOCRResult.confidence,
        textLength: mockOCRResult.text.length,
      });

      return mockOCRResult;
    } catch (error) {
      await logger.error('Erro no OCR', error as Error, {
        component: 'useDocumentProcessing',
        action: 'performOCR',
        fileName: file.name,
      });
      
      throw new AppOCRError(
        `Erro ao extrair texto do documento: ${(error as Error).message}`,
        {
          component: 'useDocumentProcessing',
          fileName: file.name,
        }
      );
    }
  }, []);

  /**
   * Analisa texto extraído com IA
   */
  const analyzeWithAI = useCallback(async (
    text: string,
    additionalInfo?: string
  ): Promise<ExtractedData> => {
    try {
      await logger.debug('Iniciando análise com IA', {
        component: 'useDocumentProcessing',
        action: 'analyzeWithAI',
        textLength: text.length,
        hasAdditionalInfo: !!additionalInfo,
      });

      // Combina texto extraído com informações adicionais
      const fullText = additionalInfo 
        ? `${text}\n\nInformações adicionais: ${additionalInfo}`
        : text;

      // Chama serviço de IA
      const analysisResult = await analyzeDocumentText(fullText);

      await logger.info('Análise com IA concluída', {
        component: 'useDocumentProcessing',
        action: 'analyzeWithAI',
        textLength: text.length,
        resultFields: Object.keys(analysisResult).length,
      });

      return analysisResult;
    } catch (error) {
      await logger.error('Erro na análise com IA', error as Error, {
        component: 'useDocumentProcessing',
        action: 'analyzeWithAI',
        textLength: text.length,
      });
      
      throw new AppAIServiceError(
        `Erro na análise do documento: ${(error as Error).message}`,
        'Gemini',
        {
          component: 'useDocumentProcessing',
          textLength: text.length,
        }
      );
    }
  }, []);

  /**
   * Processa documento completo
   */
  const processDocument = useCallback(async (
    file: File,
    additionalInfo?: string
  ): Promise<ExtractedData> => {
    // Cria novo controller para cancelamento
    abortControllerRef.current = new AbortController();
    
    try {
      await logger.info('Iniciando processamento de documento', {
        component: 'useDocumentProcessing',
        action: 'processDocument',
        fileName: file.name,
        fileSize: file.size,
        hasAdditionalInfo: !!additionalInfo,
      });

      // Etapa 1: Validação
      updateState({
        stage: 'uploading',
        progress: 10,
        message: 'Validando arquivo...',
        error: null,
      });

      await validateFile(file);

      // Etapa 2: Upload/Preparação
      updateState({
        stage: 'processing',
        progress: 20,
        message: 'Preparando arquivo para processamento...',
      });

      const base64Data = await fileToBase64(file);

      // Etapa 3: OCR (se habilitado)
      let extractedText = '';
      if (enableOCR) {
        updateState({
          stage: 'extracting',
          progress: 40,
          message: 'Extraindo texto do documento...',
        });

        const ocrResult = await performOCR(file);
        extractedText = ocrResult.text;

        updateState({
          progress: 60,
          message: 'Texto extraído com sucesso...',
        });
      }

      // Etapa 4: Análise com IA (se habilitado)
      let result: ExtractedData;
      if (enableAI && extractedText) {
        updateState({
          stage: 'analyzing',
          progress: 70,
          message: 'Analisando documento com IA...',
        });

        result = await analyzeWithAI(extractedText, additionalInfo);

        updateState({
          progress: 90,
          message: 'Análise concluída...',
        });
      } else {
        // Resultado padrão se IA estiver desabilitada
        result = {
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
      }

      // Etapa 5: Validação final
      if (autoValidate) {
        updateState({
          progress: 95,
          message: 'Validando dados extraídos...',
        });

        try {
          validateData(result, ExtractedDataSchema);
        } catch (validationError) {
          await logger.warn('Dados extraídos contêm erros de validação', {
            component: 'useDocumentProcessing',
            action: 'processDocument',
            validationError: (validationError as Error).message,
          });
          // Continua mesmo com erros de validação
        }
      }

      // Etapa 6: Conclusão
      updateState({
        stage: 'completed',
        progress: 100,
        message: 'Documento processado com sucesso!',
        result,
      });

      await logger.info('Processamento de documento concluído', {
        component: 'useDocumentProcessing',
        action: 'processDocument',
        fileName: file.name,
        resultFields: Object.keys(result).length,
      });

      return result;
    } catch (error) {
      const handledError = await errorHandler.handleError(error as Error, {
        component: 'useDocumentProcessing',
        action: 'processDocument',
        fileName: file.name,
      });

      updateState({
        stage: 'error',
        progress: 0,
        message: handledError.userMessage,
        error: handledError,
      });

      throw handledError;
    }
  }, [
    validateFile,
    fileToBase64,
    performOCR,
    analyzeWithAI,
    enableOCR,
    enableAI,
    autoValidate,
    updateState,
  ]);

  /**
   * Cancela processamento em andamento
   */
  const cancelProcessing = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    updateState({
      stage: 'idle',
      progress: 0,
      message: 'Processamento cancelado',
      error: null,
    });

    logger.info('Processamento cancelado pelo usuário', {
      component: 'useDocumentProcessing',
      action: 'cancelProcessing',
    });
  }, [updateState]);

  /**
   * Reseta estado do processamento
   */
  const reset = useCallback(() => {
    cancelProcessing();
    
    updateState({
      stage: 'idle',
      progress: 0,
      message: 'Aguardando documento...',
      error: null,
      result: null,
    });

    logger.debug('Estado de processamento resetado', {
      component: 'useDocumentProcessing',
      action: 'reset',
    });
  }, [cancelProcessing, updateState]);

  /**
   * Gera documento de despacho
   */
  const generateDispatch = useCallback(async (
    extractedData: ExtractedData,
    additionalInfo?: string
  ): Promise<string> => {
    try {
      await logger.info('Gerando documento de despacho', {
        component: 'useDocumentProcessing',
        action: 'generateDispatch',
        hasAdditionalInfo: !!additionalInfo,
      });

      const dispatch = await generateDispatchDocument(extractedData, additionalInfo);

      await logger.info('Documento de despacho gerado', {
        component: 'useDocumentProcessing',
        action: 'generateDispatch',
        dispatchLength: dispatch.length,
      });

      return dispatch;
    } catch (error) {
      await logger.error('Erro ao gerar despacho', error as Error, {
        component: 'useDocumentProcessing',
        action: 'generateDispatch',
      });
      
      throw new AppAIServiceError(
        `Erro ao gerar despacho: ${(error as Error).message}`,
        'Gemini',
        {
          component: 'useDocumentProcessing',
        }
      );
    }
  }, []);

  // Atualiza funções no estado
  const stateWithFunctions = {
    ...state,
    processDocument,
    reset,
  };

  return {
    ...stateWithFunctions,
    
    // Ações adicionais
    cancelProcessing,
    generateDispatch,
    
    // Utilitários
    isProcessing: state.stage !== 'idle' && state.stage !== 'completed' && state.stage !== 'error',
    isCompleted: state.stage === 'completed',
    hasError: state.stage === 'error',
    canRetry: state.stage === 'error',
  };
}
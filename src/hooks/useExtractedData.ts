/**
 * Hook para gerenciar dados extraídos de documentos
 * 
 * Este hook fornece funcionalidades para processar, validar,
 * editar e gerenciar dados extraídos de documentos PDF.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { errorHandler } from '../utils/errorHandler';

// Schemas de validação
const ExtractedFieldSchema = z.object({
  id: z.string(),
  name: z.string(),
  value: z.any(),
  confidence: z.number().min(0).max(1),
  type: z.enum(['text', 'number', 'date', 'boolean', 'array', 'object']),
  required: z.boolean().default(false),
  validated: z.boolean().default(false),
  error: z.string().optional(),
  source: z.object({
    page: z.number(),
    coordinates: z.object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    }).optional(),
    text: z.string().optional(),
  }).optional(),
});

const ExtractedDataSchema = z.object({
  id: z.string(),
  documentId: z.string(),
  documentName: z.string(),
  extractedAt: z.string(),
  fields: z.array(ExtractedFieldSchema),
  metadata: z.object({
    totalPages: z.number(),
    processingTime: z.number(),
    confidence: z.number(),
    version: z.string(),
  }),
  status: z.enum(['pending', 'processing', 'completed', 'error']),
  errors: z.array(z.string()).default([]),
});

export type ExtractedField = z.infer<typeof ExtractedFieldSchema>;
export type ExtractedData = z.infer<typeof ExtractedDataSchema>;

interface UseExtractedDataOptions {
  autoValidate?: boolean; // Validar automaticamente
  autoSave?: boolean; // Salvar automaticamente
  saveDelay?: number; // Delay para auto-save
  onFieldChange?: (field: ExtractedField) => void;
  onValidationChange?: (isValid: boolean, errors: string[]) => void;
  onSave?: (data: ExtractedData) => Promise<void>;
}

interface ExtractedDataState {
  data: ExtractedData | null;
  isLoading: boolean;
  isValidating: boolean;
  isSaving: boolean;
  isValid: boolean;
  validationErrors: string[];
  hasUnsavedChanges: boolean;
  lastSaved: Date | null;
}

export function useExtractedData(options: UseExtractedDataOptions = {}) {
  const {
    autoValidate = true,
    autoSave = false,
    saveDelay = 2000,
    onFieldChange,
    onValidationChange,
    onSave,
  } = options;

  const [state, setState] = useState<ExtractedDataState>({
    data: null,
    isLoading: false,
    isValidating: false,
    isSaving: false,
    isValid: false,
    validationErrors: [],
    hasUnsavedChanges: false,
    lastSaved: null,
  });

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const validationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Função para carregar dados extraídos
  const loadData = useCallback(async (data: ExtractedData) => {
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      // Validar estrutura dos dados
      const validatedData = ExtractedDataSchema.parse(data);
      
      setState(prev => ({
        ...prev,
        data: validatedData,
        isLoading: false,
        hasUnsavedChanges: false,
      }));
      
      // Validar campos se habilitado
      if (autoValidate) {
        await validateData(validatedData);
      }
      
      logger.info('Dados extraídos carregados', {
        documentId: validatedData.documentId,
        fieldsCount: validatedData.fields.length,
      });
    } catch (error) {
      setState(prev => ({ ...prev, isLoading: false }));
      errorHandler.handleError({
        message: 'Erro ao carregar dados extraídos',
        stack: error instanceof Error ? error.stack : undefined,
        context: { data },
        severity: 'error',
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }, [autoValidate]);

  // Função para validar dados
  const validateData = useCallback(async (data?: ExtractedData) => {
    const targetData = data || state.data;
    if (!targetData) return;

    setState(prev => ({ ...prev, isValidating: true }));
    
    try {
      const errors: string[] = [];
      
      // Validar campos obrigatórios
      const requiredFields = targetData.fields.filter(field => field.required);
      const missingFields = requiredFields.filter(field => 
        !field.value || 
        (typeof field.value === 'string' && field.value.trim() === '')
      );
      
      if (missingFields.length > 0) {
        errors.push(`Campos obrigatórios não preenchidos: ${missingFields.map(f => f.name).join(', ')}`);
      }
      
      // Validar confiança mínima
      const lowConfidenceFields = targetData.fields.filter(field => 
        field.confidence < 0.7 && field.required
      );
      
      if (lowConfidenceFields.length > 0) {
        errors.push(`Campos com baixa confiança: ${lowConfidenceFields.map(f => f.name).join(', ')}`);
      }
      
      // Validar tipos de dados
      for (const field of targetData.fields) {
        if (field.value !== null && field.value !== undefined) {
          try {
            validateFieldType(field);
          } catch (typeError) {
            errors.push(`Campo ${field.name}: ${typeError}`);
          }
        }
      }
      
      const isValid = errors.length === 0;
      
      setState(prev => ({
        ...prev,
        isValidating: false,
        isValid,
        validationErrors: errors,
      }));
      
      onValidationChange?.(isValid, errors);
      
      logger.debug('Validação concluída', {
        isValid,
        errorsCount: errors.length,
        fieldsCount: targetData.fields.length,
      });
    } catch (error) {
      setState(prev => ({ ...prev, isValidating: false }));
      logger.error('Erro na validação', error);
    }
  }, [state.data, onValidationChange]);

  // Função para validar tipo de campo
  const validateFieldType = useCallback((field: ExtractedField) => {
    const { type, value } = field;
    
    switch (type) {
      case 'number':
        if (isNaN(Number(value))) {
          throw new Error('Valor deve ser um número');
        }
        break;
      case 'date':
        if (isNaN(Date.parse(value))) {
          throw new Error('Valor deve ser uma data válida');
        }
        break;
      case 'boolean':
        if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
          throw new Error('Valor deve ser verdadeiro ou falso');
        }
        break;
      case 'array':
        if (!Array.isArray(value)) {
          throw new Error('Valor deve ser uma lista');
        }
        break;
      case 'object':
        if (typeof value !== 'object' || Array.isArray(value)) {
          throw new Error('Valor deve ser um objeto');
        }
        break;
    }
  }, []);

  // Função para atualizar campo
  const updateField = useCallback((fieldId: string, updates: Partial<ExtractedField>) => {
    if (!state.data) return;
    
    const updatedData = {
      ...state.data,
      fields: state.data.fields.map(field => 
        field.id === fieldId 
          ? { ...field, ...updates, validated: true }
          : field
      ),
    };
    
    setState(prev => ({
      ...prev,
      data: updatedData,
      hasUnsavedChanges: true,
    }));
    
    // Callback de mudança
    const updatedField = updatedData.fields.find(f => f.id === fieldId);
    if (updatedField) {
      onFieldChange?.(updatedField);
    }
    
    // Validação automática com debounce
    if (autoValidate) {
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current);
      }
      
      validationTimeoutRef.current = setTimeout(() => {
        validateData(updatedData);
      }, 500);
    }
    
    // Auto-save com debounce
    if (autoSave && onSave) {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      
      saveTimeoutRef.current = setTimeout(() => {
        saveData(updatedData);
      }, saveDelay);
    }
    
    logger.debug('Campo atualizado', {
      fieldId,
      fieldName: updatedField?.name,
      updates,
    });
  }, [state.data, autoValidate, autoSave, onSave, saveDelay, onFieldChange, validateData]);

  // Função para salvar dados
  const saveData = useCallback(async (data?: ExtractedData) => {
    const targetData = data || state.data;
    if (!targetData || !onSave) return;
    
    setState(prev => ({ ...prev, isSaving: true }));
    
    try {
      await onSave(targetData);
      
      setState(prev => ({
        ...prev,
        isSaving: false,
        hasUnsavedChanges: false,
        lastSaved: new Date(),
      }));
      
      logger.info('Dados salvos com sucesso', {
        documentId: targetData.documentId,
      });
    } catch (error) {
      setState(prev => ({ ...prev, isSaving: false }));
      logger.error('Erro ao salvar dados', error);
      throw error;
    }
  }, [state.data, onSave]);

  // Função para obter campo por ID
  const getField = useCallback((fieldId: string): ExtractedField | undefined => {
    return state.data?.fields.find(field => field.id === fieldId);
  }, [state.data]);

  // Função para obter campos por tipo
  const getFieldsByType = useCallback((type: ExtractedField['type']): ExtractedField[] => {
    return state.data?.fields.filter(field => field.type === type) || [];
  }, [state.data]);

  // Função para obter campos obrigatórios
  const getRequiredFields = useCallback((): ExtractedField[] => {
    return state.data?.fields.filter(field => field.required) || [];
  }, [state.data]);

  // Função para obter campos com baixa confiança
  const getLowConfidenceFields = useCallback((threshold: number = 0.7): ExtractedField[] => {
    return state.data?.fields.filter(field => field.confidence < threshold) || [];
  }, [state.data]);

  // Função para exportar dados
  const exportData = useCallback((format: 'json' | 'csv' = 'json') => {
    if (!state.data) return null;
    
    if (format === 'json') {
      return JSON.stringify(state.data, null, 2);
    }
    
    // CSV format
    const headers = ['Campo', 'Valor', 'Tipo', 'Confiança', 'Obrigatório', 'Validado'];
    const rows = state.data.fields.map(field => [
      field.name,
      String(field.value || ''),
      field.type,
      field.confidence.toFixed(2),
      field.required ? 'Sim' : 'Não',
      field.validated ? 'Sim' : 'Não',
    ]);
    
    return [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
  }, [state.data]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current);
      }
    };
  }, []);

  return {
    // Estado
    ...state,
    
    // Funções principais
    loadData,
    validateData,
    updateField,
    saveData,
    
    // Consultas
    getField,
    getFieldsByType,
    getRequiredFields,
    getLowConfidenceFields,
    
    // Utilitários
    exportData,
  };
}

// Hook simplificado para edição de campos
export function useFieldEditor(fieldId: string, extractedData: ExtractedData) {
  const [localValue, setLocalValue] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  const field = extractedData.fields.find(f => f.id === fieldId);
  
  useEffect(() => {
    if (field && !isEditing) {
      setLocalValue(field.value);
    }
  }, [field, isEditing]);
  
  const startEditing = useCallback(() => {
    setIsEditing(true);
    setLocalValue(field?.value);
  }, [field]);
  
  const cancelEditing = useCallback(() => {
    setIsEditing(false);
    setLocalValue(field?.value);
  }, [field]);
  
  const saveEdit = useCallback((newValue: any) => {
    setLocalValue(newValue);
    setIsEditing(false);
    return newValue;
  }, []);
  
  return {
    field,
    localValue,
    isEditing,
    startEditing,
    cancelEditing,
    saveEdit,
    setLocalValue,
  };
}
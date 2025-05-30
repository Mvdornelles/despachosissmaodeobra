/**
 * Hook para validação de formulários
 * 
 * Este hook fornece validação em tempo real para formulários,
 * com suporte a schemas Zod, validação customizada e feedback visual.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { errorHandler, AppValidationError } from '../utils/errorHandler';
import { FieldValidationState, ValidationConfig, ValidationResult } from './types';

/**
 * Configuração de validação de campo
 */
interface FieldConfig {
  required?: boolean;
  schema?: z.ZodSchema;
  validator?: (value: any) => string | null;
  debounceMs?: number;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  dependencies?: string[];
}

/**
 * Estado de validação do formulário
 */
interface FormValidationState {
  fields: Record<string, FieldValidationState>;
  isValid: boolean;
  isValidating: boolean;
  errors: Record<string, string>;
  warnings: Record<string, string>;
  touched: Record<string, boolean>;
  submitted: boolean;
}

/**
 * Configuração do hook de validação
 */
interface UseValidationConfig {
  schema?: z.ZodSchema;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  validateOnSubmit?: boolean;
  debounceMs?: number;
  showErrorsOnlyAfterSubmit?: boolean;
  onValidationChange?: (isValid: boolean, errors: Record<string, string>) => void;
}

/**
 * Hook de validação de formulários
 */
export function useValidation<T extends Record<string, any>>(
  initialValues: T,
  config: UseValidationConfig = {}
) {
  const {
    schema,
    validateOnChange = true,
    validateOnBlur = true,
    validateOnSubmit = true,
    debounceMs = 300,
    showErrorsOnlyAfterSubmit = false,
    onValidationChange,
  } = config;

  // Estado do formulário
  const [values, setValues] = useState<T>(initialValues);
  const [state, setState] = useState<FormValidationState>({
    fields: {},
    isValid: true,
    isValidating: false,
    errors: {},
    warnings: {},
    touched: {},
    submitted: false,
  });

  // Configurações de campos
  const fieldConfigsRef = useRef<Record<string, FieldConfig>>({});
  const debounceTimeoutsRef = useRef<Record<string, NodeJS.Timeout>>({});
  const validationCounterRef = useRef(0);

  /**
   * Atualiza estado de forma segura
   */
  const updateState = useCallback((updates: Partial<FormValidationState>) => {
    setState(prev => {
      const newState = { ...prev, ...updates };
      
      // Callback de mudança de validação
      if (onValidationChange && 
          (updates.isValid !== undefined || updates.errors !== undefined)) {
        onValidationChange(newState.isValid, newState.errors);
      }
      
      return newState;
    });
  }, [onValidationChange]);

  /**
   * Configura validação para um campo
   */
  const configureField = useCallback((fieldName: string, config: FieldConfig) => {
    fieldConfigsRef.current[fieldName] = config;
    
    logger.debug('Campo configurado para validação', {
      component: 'useValidation',
      action: 'configureField',
      fieldName,
      hasSchema: !!config.schema,
      hasValidator: !!config.validator,
      required: config.required,
    });
  }, []);

  /**
   * Valida um campo específico
   */
  const validateField = useCallback(async (
    fieldName: string,
    value: any,
    allValues: T = values
  ): Promise<ValidationResult> => {
    const validationId = ++validationCounterRef.current;
    
    try {
      await logger.debug('Validando campo', {
        component: 'useValidation',
        action: 'validateField',
        fieldName,
        validationId,
        hasValue: value !== undefined && value !== null && value !== '',
      });

      const fieldConfig = fieldConfigsRef.current[fieldName];
      const errors: string[] = [];
      const warnings: string[] = [];

      // Validação de campo obrigatório
      if (fieldConfig?.required && (value === undefined || value === null || value === '')) {
        errors.push('Este campo é obrigatório');
      }

      // Validação com schema Zod específico do campo
      if (fieldConfig?.schema && value !== undefined && value !== null && value !== '') {
        try {
          fieldConfig.schema.parse(value);
        } catch (error) {
          if (error instanceof z.ZodError) {
            errors.push(...error.errors.map(e => e.message));
          } else {
            errors.push('Erro de validação');
          }
        }
      }

      // Validação customizada do campo
      if (fieldConfig?.validator && value !== undefined && value !== null && value !== '') {
        try {
          const customError = fieldConfig.validator(value);
          if (customError) {
            errors.push(customError);
          }
        } catch (error) {
          errors.push('Erro na validação customizada');
          await logger.error('Erro na validação customizada', error as Error, {
            component: 'useValidation',
            action: 'validateField',
            fieldName,
          });
        }
      }

      // Validação com schema global
      if (schema && errors.length === 0) {
        try {
          const testValues = { ...allValues, [fieldName]: value };
          schema.parse(testValues);
        } catch (error) {
          if (error instanceof z.ZodError) {
            const fieldErrors = error.errors
              .filter(e => e.path.includes(fieldName))
              .map(e => e.message);
            errors.push(...fieldErrors);
          }
        }
      }

      const result: ValidationResult = {
        isValid: errors.length === 0,
        errors,
        warnings,
        field: fieldName,
        value,
      };

      await logger.debug('Validação de campo concluída', {
        component: 'useValidation',
        action: 'validateField',
        fieldName,
        validationId,
        isValid: result.isValid,
        errorCount: errors.length,
        warningCount: warnings.length,
      });

      return result;
    } catch (error) {
      await logger.error('Erro na validação do campo', error as Error, {
        component: 'useValidation',
        action: 'validateField',
        fieldName,
        validationId,
      });

      return {
        isValid: false,
        errors: ['Erro interno na validação'],
        warnings: [],
        field: fieldName,
        value,
      };
    }
  }, [values, schema]);

  /**
   * Valida todos os campos
   */
  const validateAll = useCallback(async (valuesToValidate: T = values): Promise<ValidationResult[]> => {
    const validationId = ++validationCounterRef.current;
    
    try {
      updateState({ isValidating: true });
      
      await logger.debug('Validando todos os campos', {
        component: 'useValidation',
        action: 'validateAll',
        validationId,
        fieldCount: Object.keys(valuesToValidate).length,
      });

      const results: ValidationResult[] = [];
      const newErrors: Record<string, string> = {};
      const newWarnings: Record<string, string> = {};

      // Valida cada campo
      for (const [fieldName, value] of Object.entries(valuesToValidate)) {
        const result = await validateField(fieldName, value, valuesToValidate);
        results.push(result);

        if (!result.isValid && result.errors.length > 0) {
          newErrors[fieldName] = result.errors[0]; // Pega apenas o primeiro erro
        }

        if (result.warnings.length > 0) {
          newWarnings[fieldName] = result.warnings[0]; // Pega apenas o primeiro warning
        }
      }

      // Validação global com schema
      if (schema) {
        try {
          schema.parse(valuesToValidate);
        } catch (error) {
          if (error instanceof z.ZodError) {
            error.errors.forEach(e => {
              const fieldName = e.path.join('.');
              if (!newErrors[fieldName]) {
                newErrors[fieldName] = e.message;
              }
            });
          }
        }
      }

      const isValid = Object.keys(newErrors).length === 0;

      updateState({
        isValidating: false,
        isValid,
        errors: newErrors,
        warnings: newWarnings,
      });

      await logger.info('Validação completa concluída', {
        component: 'useValidation',
        action: 'validateAll',
        validationId,
        isValid,
        errorCount: Object.keys(newErrors).length,
        warningCount: Object.keys(newWarnings).length,
      });

      return results;
    } catch (error) {
      await logger.error('Erro na validação completa', error as Error, {
        component: 'useValidation',
        action: 'validateAll',
        validationId,
      });

      updateState({ isValidating: false });
      throw error;
    }
  }, [values, schema, validateField, updateState]);

  /**
   * Valida campo com debounce
   */
  const validateFieldDebounced = useCallback((fieldName: string, value: any) => {
    const fieldConfig = fieldConfigsRef.current[fieldName];
    const delay = fieldConfig?.debounceMs ?? debounceMs;

    // Limpa timeout anterior
    if (debounceTimeoutsRef.current[fieldName]) {
      clearTimeout(debounceTimeoutsRef.current[fieldName]);
    }

    // Configura novo timeout
    debounceTimeoutsRef.current[fieldName] = setTimeout(async () => {
      try {
        const result = await validateField(fieldName, value);
        
        // Atualiza estado apenas se deve mostrar erros
        const shouldShowError = !showErrorsOnlyAfterSubmit || state.submitted;
        
        if (shouldShowError) {
          updateState({
            errors: {
              ...state.errors,
              [fieldName]: result.errors[0] || '',
            },
            warnings: {
              ...state.warnings,
              [fieldName]: result.warnings[0] || '',
            },
          });
        }
      } catch (error) {
        await logger.error('Erro na validação com debounce', error as Error, {
          component: 'useValidation',
          action: 'validateFieldDebounced',
          fieldName,
        });
      }
    }, delay);
  }, [debounceMs, validateField, showErrorsOnlyAfterSubmit, state.submitted, state.errors, state.warnings, updateState]);

  /**
   * Atualiza valor de um campo
   */
  const setValue = useCallback((fieldName: string, value: any) => {
    setValues(prev => ({ ...prev, [fieldName]: value }));
    
    // Marca campo como tocado
    updateState({
      touched: { ...state.touched, [fieldName]: true },
    });

    // Valida se configurado para validar onChange
    const fieldConfig = fieldConfigsRef.current[fieldName];
    const shouldValidate = fieldConfig?.validateOnChange ?? validateOnChange;
    
    if (shouldValidate) {
      validateFieldDebounced(fieldName, value);
    }

    logger.debug('Valor do campo atualizado', {
      component: 'useValidation',
      action: 'setValue',
      fieldName,
      hasValue: value !== undefined && value !== null && value !== '',
    });
  }, [state.touched, validateOnChange, validateFieldDebounced, updateState]);

  /**
   * Atualiza múltiplos valores
   */
  const setValues = useCallback((newValues: Partial<T>) => {
    setValues(prev => ({ ...prev, ...newValues }));
    
    // Marca campos como tocados
    const newTouched = Object.keys(newValues).reduce((acc, key) => {
      acc[key] = true;
      return acc;
    }, {} as Record<string, boolean>);
    
    updateState({
      touched: { ...state.touched, ...newTouched },
    });

    // Valida campos se necessário
    if (validateOnChange) {
      Object.entries(newValues).forEach(([fieldName, value]) => {
        validateFieldDebounced(fieldName, value);
      });
    }

    logger.debug('Múltiplos valores atualizados', {
      component: 'useValidation',
      action: 'setValues',
      fieldCount: Object.keys(newValues).length,
    });
  }, [state.touched, validateOnChange, validateFieldDebounced, updateState]);

  /**
   * Handler para blur de campo
   */
  const handleBlur = useCallback(async (fieldName: string) => {
    updateState({
      touched: { ...state.touched, [fieldName]: true },
    });

    // Valida se configurado para validar onBlur
    const fieldConfig = fieldConfigsRef.current[fieldName];
    const shouldValidate = fieldConfig?.validateOnBlur ?? validateOnBlur;
    
    if (shouldValidate) {
      try {
        const result = await validateField(fieldName, values[fieldName]);
        
        const shouldShowError = !showErrorsOnlyAfterSubmit || state.submitted;
        
        if (shouldShowError) {
          updateState({
            errors: {
              ...state.errors,
              [fieldName]: result.errors[0] || '',
            },
            warnings: {
              ...state.warnings,
              [fieldName]: result.warnings[0] || '',
            },
          });
        }
      } catch (error) {
        await logger.error('Erro na validação onBlur', error as Error, {
          component: 'useValidation',
          action: 'handleBlur',
          fieldName,
        });
      }
    }

    logger.debug('Campo perdeu foco', {
      component: 'useValidation',
      action: 'handleBlur',
      fieldName,
    });
  }, [state.touched, state.submitted, state.errors, state.warnings, validateOnBlur, validateField, values, showErrorsOnlyAfterSubmit, updateState]);

  /**
   * Submete formulário com validação
   */
  const handleSubmit = useCallback(async (onSubmit: (values: T) => void | Promise<void>) => {
    try {
      updateState({ submitted: true });
      
      await logger.info('Submetendo formulário', {
        component: 'useValidation',
        action: 'handleSubmit',
      });

      if (validateOnSubmit) {
        const results = await validateAll(values);
        const hasErrors = results.some(r => !r.isValid);
        
        if (hasErrors) {
          await logger.warn('Formulário submetido com erros de validação', {
            component: 'useValidation',
            action: 'handleSubmit',
            errorCount: results.filter(r => !r.isValid).length,
          });
          return;
        }
      }

      await onSubmit(values);
      
      await logger.info('Formulário submetido com sucesso', {
        component: 'useValidation',
        action: 'handleSubmit',
      });
    } catch (error) {
      await logger.error('Erro na submissão do formulário', error as Error, {
        component: 'useValidation',
        action: 'handleSubmit',
      });
      throw error;
    }
  }, [validateOnSubmit, validateAll, values, updateState]);

  /**
   * Reseta formulário
   */
  const reset = useCallback((newValues: T = initialValues) => {
    setValues(newValues);
    setState({
      fields: {},
      isValid: true,
      isValidating: false,
      errors: {},
      warnings: {},
      touched: {},
      submitted: false,
    });

    // Limpa timeouts de debounce
    Object.values(debounceTimeoutsRef.current).forEach(timeout => clearTimeout(timeout));
    debounceTimeoutsRef.current = {};

    logger.info('Formulário resetado', {
      component: 'useValidation',
      action: 'reset',
    });
  }, [initialValues]);

  /**
   * Limpa erros
   */
  const clearErrors = useCallback((fieldNames?: string[]) => {
    if (fieldNames) {
      const newErrors = { ...state.errors };
      fieldNames.forEach(fieldName => {
        delete newErrors[fieldName];
      });
      updateState({ errors: newErrors });
    } else {
      updateState({ errors: {} });
    }

    logger.debug('Erros limpos', {
      component: 'useValidation',
      action: 'clearErrors',
      fieldNames: fieldNames || 'all',
    });
  }, [state.errors, updateState]);

  // Cleanup no unmount
  useEffect(() => {
    return () => {
      Object.values(debounceTimeoutsRef.current).forEach(timeout => clearTimeout(timeout));
    };
  }, []);

  return {
    // Valores
    values,
    
    // Estado
    ...state,
    
    // Ações
    setValue,
    setValues,
    configureField,
    validateField,
    validateAll,
    handleBlur,
    handleSubmit,
    reset,
    clearErrors,
    
    // Utilitários
    getFieldError: (fieldName: string) => state.errors[fieldName] || '',
    getFieldWarning: (fieldName: string) => state.warnings[fieldName] || '',
    hasFieldError: (fieldName: string) => !!state.errors[fieldName],
    hasFieldWarning: (fieldName: string) => !!state.warnings[fieldName],
    isFieldTouched: (fieldName: string) => !!state.touched[fieldName],
    shouldShowFieldError: (fieldName: string) => {
      const hasError = !!state.errors[fieldName];
      const isTouched = !!state.touched[fieldName];
      return hasError && (isTouched || state.submitted || !showErrorsOnlyAfterSubmit);
    },
    canSubmit: state.isValid && !state.isValidating,
    hasErrors: Object.keys(state.errors).length > 0,
    hasWarnings: Object.keys(state.warnings).length > 0,
    touchedFieldCount: Object.keys(state.touched).length,
    errorFieldCount: Object.keys(state.errors).length,
  };
}
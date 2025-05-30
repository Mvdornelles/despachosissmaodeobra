/**
 * Esquemas de validação usando Zod
 * 
 * Este módulo define todos os esquemas de validação para garantir
 * a integridade dos dados em toda a aplicação.
 */

import { z } from 'zod';

/**
 * Schema para validação de dados extraídos de documentos
 */
export const ExtractedDataSchema = z.object({
  // Dados do contribuinte
  NomeContribuinte: z.string().min(1, 'Nome do contribuinte é obrigatório'),
  CPFContribuinte: z.string().regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, 'CPF deve estar no formato XXX.XXX.XXX-XX'),
  EnderecoContribuinte: z.string().min(1, 'Endereço do contribuinte é obrigatório'),
  
  // Dados do imóvel
  EnderecoImovel: z.string().min(1, 'Endereço do imóvel é obrigatório'),
  InscricaoImobiliaria: z.string().min(1, 'Inscrição imobiliária é obrigatória'),
  
  // Dados da obra
  TipoObra: z.string().min(1, 'Tipo de obra é obrigatório'),
  AreaConstrucao: z.string().min(1, 'Área de construção é obrigatória'),
  
  // Valores financeiros
  ValorAvaliacaoMaoObraISSQN: z.string().min(1, 'Valor de avaliação é obrigatório'),
  ValorRecolherISSQN: z.string().optional(),
  PercentualISSQN: z.string().default('3'),
  
  // Dados do responsável técnico
  NomeResponsavelTecnico: z.string().min(1, 'Nome do responsável técnico é obrigatório'),
  RegistroResponsavelTecnico: z.string().min(1, 'Registro do responsável técnico é obrigatório'),
  
  // Dados do fiscal
  NomeFiscalAuditor: z.string().optional(),
  
  // Template do despacho
  TemplateDespacho: z.string().optional(),
});

/**
 * Schema para validação de credenciais de usuário
 */
export const UserCredentialsSchema = z.object({
  email: z.string().email('Email deve ter um formato válido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
});

/**
 * Schema para validação de arquivo de upload
 */
export const FileUploadSchema = z.object({
  file: z.instanceof(File, 'Arquivo é obrigatório'),
  type: z.enum(['pdf', 'image'], 'Tipo de arquivo deve ser PDF ou imagem'),
  size: z.number().max(10 * 1024 * 1024, 'Arquivo deve ter no máximo 10MB'),
});

/**
 * Schema para validação de informações adicionais
 */
export const AdditionalInfoSchema = z.object({
  additionalInfo: z.string().max(1000, 'Informações adicionais devem ter no máximo 1000 caracteres'),
});

/**
 * Schema para validação de seleção de auditor fiscal
 */
export const FiscalAuditorSchema = z.object({
  auditorName: z.string().min(1, 'Nome do auditor fiscal é obrigatório'),
});

/**
 * Schema para validação de mensagem de status
 */
export const StatusMessageSchema = z.object({
  type: z.enum(['success', 'error', 'warning', 'info'], 'Tipo de mensagem inválido'),
  message: z.string().min(1, 'Mensagem é obrigatória'),
  timestamp: z.date().optional(),
});

/**
 * Schema para validação de configuração de ambiente
 */
export const EnvConfigSchema = z.object({
  SUPABASE_URL: z.string().url('URL do Supabase deve ser válida'),
  SUPABASE_ANON_KEY: z.string().min(20, 'Chave anônima do Supabase deve ter pelo menos 20 caracteres'),
  GEMINI_API_KEY: z.string().min(20, 'Chave da API Gemini deve ter pelo menos 20 caracteres'),
  APP_NAME: z.string().min(1, 'Nome da aplicação é obrigatório'),
  APP_VERSION: z.string().regex(/^\d+\.\d+\.\d+$/, 'Versão deve estar no formato X.Y.Z'),
  APP_DESCRIPTION: z.string().min(1, 'Descrição da aplicação é obrigatória'),
  DEV_MODE: z.boolean(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']),
  ANALYTICS_ID: z.string().optional(),
  SENTRY_DSN: z.string().url().optional(),
  ENABLE_BETA_FEATURES: z.boolean(),
  ENABLE_DEBUG_MODE: z.boolean(),
});

/**
 * Schema para validação de dados de sessão do usuário
 */
export const UserSessionSchema = z.object({
  id: z.string().uuid('ID do usuário deve ser um UUID válido'),
  email: z.string().email('Email deve ter um formato válido'),
  created_at: z.string().datetime('Data de criação deve ser um datetime válido'),
  last_sign_in_at: z.string().datetime().optional(),
});

/**
 * Schema para validação de resposta da API Gemini
 */
export const GeminiResponseSchema = z.object({
  text: z.string().min(1, 'Resposta da API deve conter texto'),
  finishReason: z.string().optional(),
  safetyRatings: z.array(z.object({
    category: z.string(),
    probability: z.string(),
  })).optional(),
});

/**
 * Schema para validação de dados de OCR
 */
export const OCRResultSchema = z.object({
  text: z.string(),
  confidence: z.number().min(0).max(100),
  words: z.array(z.object({
    text: z.string(),
    confidence: z.number().min(0).max(100),
    bbox: z.object({
      x0: z.number(),
      y0: z.number(),
      x1: z.number(),
      y1: z.number(),
    }),
  })).optional(),
});

/**
 * Schema para validação de progresso de upload
 */
export const UploadProgressSchema = z.object({
  stage: z.enum(['uploading', 'processing', 'extracting', 'analyzing', 'completed']),
  progress: z.number().min(0).max(100),
  message: z.string(),
  error: z.string().optional(),
});

// Tipos TypeScript derivados dos schemas
export type ExtractedData = z.infer<typeof ExtractedDataSchema>;
export type UserCredentials = z.infer<typeof UserCredentialsSchema>;
export type FileUpload = z.infer<typeof FileUploadSchema>;
export type AdditionalInfo = z.infer<typeof AdditionalInfoSchema>;
export type FiscalAuditor = z.infer<typeof FiscalAuditorSchema>;
export type StatusMessage = z.infer<typeof StatusMessageSchema>;
export type EnvConfig = z.infer<typeof EnvConfigSchema>;
export type UserSession = z.infer<typeof UserSessionSchema>;
export type GeminiResponse = z.infer<typeof GeminiResponseSchema>;
export type OCRResult = z.infer<typeof OCRResultSchema>;
export type UploadProgress = z.infer<typeof UploadProgressSchema>;

/**
 * Utilitários de validação
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public field: string,
    public code: string
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Valida dados usando um schema Zod e retorna resultado tipado
 */
export function validateData<T>(
  data: unknown,
  schema: z.ZodSchema<T>,
  context?: string
): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      const field = firstError.path.join('.');
      const message = context 
        ? `${context}: ${firstError.message}`
        : firstError.message;
      
      throw new ValidationError(message, field, firstError.code);
    }
    throw error;
  }
}

/**
 * Valida dados de forma segura, retornando resultado ou erro
 */
export function safeValidateData<T>(
  data: unknown,
  schema: z.ZodSchema<T>
): { success: true; data: T } | { success: false; error: ValidationError } {
  try {
    const validatedData = validateData(data, schema);
    return { success: true, data: validatedData };
  } catch (error) {
    if (error instanceof ValidationError) {
      return { success: false, error };
    }
    return { 
      success: false, 
      error: new ValidationError(
        'Erro de validação desconhecido',
        'unknown',
        'unknown'
      )
    };
  }
}

/**
 * Valida parcialmente um objeto (útil para formulários)
 */
export function validatePartial<T>(
  data: unknown,
  schema: z.ZodSchema<T>
): Partial<T> {
  const partialSchema = schema.partial();
  return partialSchema.parse(data);
}

/**
 * Sanitiza dados removendo campos não definidos no schema
 */
export function sanitizeData<T>(
  data: unknown,
  schema: z.ZodSchema<T>
): unknown {
  if (typeof data !== 'object' || data === null) {
    return data;
  }
  
  const schemaKeys = Object.keys(schema.shape || {});
  const sanitized: Record<string, unknown> = {};
  
  for (const key of schemaKeys) {
    if (key in (data as Record<string, unknown>)) {
      sanitized[key] = (data as Record<string, unknown>)[key];
    }
  }
  
  return sanitized;
}
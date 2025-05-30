

import { GoogleGenerativeAI } from '@google/generative-ai';
import { ExtractedData } from '../types';
import { GEMINI_TEXT_MODEL, PROMPT_ANALISE, FIXED_DESPACHO_TEMPLATE } from '../constants';
import { env, logger } from '../src/config/env';

/**
 * Cliente Google Generative AI configurado com variáveis de ambiente validadas
 */
const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);

// Log de inicialização em modo de desenvolvimento
logger.debug('Gemini AI client inicializado', {
  model: GEMINI_TEXT_MODEL,
  apiKeyLength: env.GEMINI_API_KEY.length,
}); 

const parseJsonFromGeminiResponse = (responseText: string): any => {
  let jsonStr = responseText.trim();
  const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s; 
  const match = jsonStr.match(fenceRegex);
  if (match && match[2]) {
    jsonStr = match[2].trim();
  }
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error("Failed to parse JSON from Gemini response:", e);
    console.error("Original response text:", responseText);
    throw new Error("A IA retornou uma resposta que não é um JSON válido.");
  }
};

/**
 * Analisa texto extraído de documento usando IA Gemini
 * @param text - Texto bruto extraído do documento
 * @param prompt - Prompt personalizado para extração
 * @returns Promise com dados estruturados ou erro
 */
export const analyzeDocumentText = async (text: string, prompt: string): Promise<ExtractedData> => {
  const fullPrompt = prompt.replace('{TEXTO_EXTRAIDO}', text);

  try {
    logger.debug('Iniciando análise de documento com Gemini', {
      textLength: text.length,
      promptLength: fullPrompt.length,
    });

    const model = genAI.getGenerativeModel({ model: GEMINI_TEXT_MODEL });
    
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
      generationConfig: {
        temperature: 0.1,
        topK: 1,
        topP: 1,
        maxOutputTokens: 2048,
      },
    });
    
    const response = await result.response;
    const extractedRaw = response.text();
    
    logger.debug('Resposta recebida do Gemini', {
      responseLength: extractedRaw.length,
    });
    
    const extractedJson = parseJsonFromGeminiResponse(extractedRaw) as ExtractedData;
    
    logger.info('Análise de documento concluída com sucesso');
    return extractedJson;

  } catch (error) {
    logger.error('Erro ao chamar API Gemini para análise:', error);
    if (error instanceof Error) {
       throw new Error(`Erro ao analisar documento com IA: ${error.message}`);
    }
    throw new Error('Erro desconhecido ao analisar documento com IA.');
  }
};

/**
 * Gera documento de despacho final usando IA Gemini
 * @param structuredDataFromExtraction - Dados estruturados extraídos
 * @param additionalInfo - Informações adicionais do usuário
 * @param currentDate - Data atual formatada
 * @param promptTemplate - Template do prompt para geração
 * @param selectedFiscalAuditor - Auditor fiscal selecionado
 * @returns Promise com texto do despacho gerado
 */
export const generateDispatchDocument = async (
  structuredDataFromExtraction: ExtractedData,
  additionalInfo: string,
  currentDate: string,
  promptTemplate: string,
  selectedFiscalAuditor: string
): Promise<string> => {

  // Calculate ValorRecolherISSQN
  let calculatedValorRecolherISSQN: string | null = null;
  const valorAvaliacaoStr = structuredDataFromExtraction.ValorAvaliacaoMaoObraISSQN;

  if (valorAvaliacaoStr) {
    try {
      // Clean the string: remove "R$", trim, replace "." for thousands, and "," for decimal.
      const cleanedString = valorAvaliacaoStr
        .replace("R$", "")
        .trim()
        .replace(/\./g, "")
        .replace(",", ".");
      
      const numericValue = parseFloat(cleanedString);

      if (!isNaN(numericValue)) {
        const issqnValue = numericValue * 0.03;
        // Format back to pt-BR currency string
        calculatedValorRecolherISSQN = issqnValue.toLocaleString('pt-BR', {
          style: 'decimal', // Use 'decimal' to avoid R$ symbol here, as template might have it
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      } else {
        console.warn('ValorAvaliacaoMaoObraISSQN could not be parsed to a number:', valorAvaliacaoStr);
      }
    } catch (e) {
      console.error('Error calculating ValorRecolherISSQN:', e);
    }
  }

  // Create a new data object for the prompt, including the fixed/selected/calculated values
  const dataForPrompt: Record<string, string | null | undefined> = {
    ...structuredDataFromExtraction,
    PercentualISSQN: "3", // Fixed value
    NomeFiscalAuditor: selectedFiscalAuditor, // From dropdown
    ValorRecolherISSQN: calculatedValorRecolherISSQN, // Calculated value
  };

  const structuredDataJsonString = JSON.stringify(dataForPrompt, null, 2);

  let fullPrompt = promptTemplate;
  fullPrompt = fullPrompt.replace('{DADOS_ESTRUTURADOS_JSON}', structuredDataJsonString);
  fullPrompt = fullPrompt.replace('{INFO_ADICIONAL}', additionalInfo || "Nenhuma");
  fullPrompt = fullPrompt.replace('{DATA_ATUAL}', currentDate);
  
  try {
    logger.debug('Iniciando geração de despacho com Gemini', {
      auditor: selectedFiscalAuditor,
      additionalInfoLength: additionalInfo.length,
      valorRecolher: calculatedValorRecolherISSQN,
    });

    const model = genAI.getGenerativeModel({ model: GEMINI_TEXT_MODEL });
    
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
      generationConfig: {
        temperature: 0.2,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 4096,
      },
    });
    
    const response = await result.response;
    const generatedText = response.text().trim();
    
    logger.info('Despacho gerado com sucesso', {
      outputLength: generatedText.length,
    });
    
    return generatedText;

  } catch (error) {
    logger.error('Erro ao chamar API Gemini para geração de despacho:', error);
     if (error instanceof Error) {
       throw new Error(`Erro ao gerar despacho com IA: ${error.message}`);
    }
    throw new Error('Erro desconhecido ao gerar despacho com IA.');
  }
};

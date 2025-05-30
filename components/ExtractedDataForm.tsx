
import React from 'react';
import { useAppContext } from '../contexts/AppContext';
import { analyzeDocumentText } from '../services/geminiService';
import { PROMPT_ANALISE, EXTRACTED_DATA_KEYS, EXTRACTED_DATA_LABELS } from '../constants';
import { ExtractedData } from '../types';
import { FaMagic } from 'react-icons/fa';
import { Spinner } from './Spinner';

export const ExtractedDataForm: React.FC = () => {
  const {
    rawExtractedText,
    setRawExtractedText,
    structuredExtractedInfo,
    setStructuredExtractedInfo,
    updateStructuredExtractedInfoField,
    isLoading,
    setIsLoading,
    setStatusMessage,
    clearStatusMessageAfterDelay,
    currentFile
  } = useAppContext();

  const handleAnalyzeText = async () => {
    if (!rawExtractedText.trim()) {
      setStatusMessage({ text: 'Nenhum texto extraído para analisar.', type: 'warning' });
      clearStatusMessageAfterDelay();
      return;
    }
    setIsLoading(true);
    setStatusMessage({ text: 'Analisando documento com IA...', type: 'info' });
    try {
      const extractedData = await analyzeDocumentText(rawExtractedText, PROMPT_ANALISE);
      setStructuredExtractedInfo(extractedData);
      setStatusMessage({ text: 'Dados extraídos e estruturados pela IA!', type: 'success' });
      clearStatusMessageAfterDelay();
    } catch (error: any) {
      console.error("Error analyzing text with AI:", error);
      setStatusMessage({ text: error.message || 'Falha ao analisar texto com IA.', type: 'error' });
      // Do not auto-clear error messages, user should dismiss or new status overwrites it
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: keyof ExtractedData, value: string) => {
    updateStructuredExtractedInfoField(field, value);
  };

  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="raw-ocr-text" className="block text-sm font-medium text-slate-300 mb-1">
          Texto Extraído do Documento (OCR/PDF)
        </label>
        <textarea
          id="raw-ocr-text"
          value={rawExtractedText}
          onChange={(e) => setRawExtractedText(e.target.value)}
          rows={8}
          className="w-full p-3 bg-slate-900 border border-slate-700 rounded-md shadow-sm text-sm text-slate-300 focus:ring-sky-500 focus:border-sky-500"
          placeholder="O texto extraído do seu documento aparecerá aqui..."
        />
        <button
          onClick={handleAnalyzeText}
          disabled={isLoading || !rawExtractedText.trim() || !currentFile}
          className="mt-3 w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-sky-500 disabled:bg-slate-500 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading && structuredExtractedInfo && Object.keys(structuredExtractedInfo).length === 0 ? <Spinner size="sm" color="text-white" className="mr-2"/> : <FaMagic className="mr-2" />}
          Extrair Informações do Documento com IA
        </button>
      </div>

      {Object.keys(structuredExtractedInfo).length > 0 && (
        <div>
          <h3 className="text-lg font-medium text-slate-300 mb-3">Informações Identificadas pela IA (Editável)</h3>
          <div className="space-y-4">
            {EXTRACTED_DATA_KEYS.map((key) => (
              <div key={key as string}>
                <label htmlFor={key as string} className="block text-sm font-medium text-slate-400">
                  {EXTRACTED_DATA_LABELS[key] || key}
                </label>
                <input
                  type="text"
                  id={key as string}
                  name={key as string}
                  value={structuredExtractedInfo[key] || ''}
                  onChange={(e) => handleInputChange(key, e.target.value)}
                  className="mt-1 block w-full p-2 bg-slate-700 border border-slate-600 rounded-md shadow-sm text-sm text-slate-200 focus:ring-sky-500 focus:border-sky-500 placeholder-slate-500"
                  placeholder={structuredExtractedInfo[key] === null ? '(Não encontrado pela IA)' : 'Digite o valor'}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};


import React from 'react';
import { useAppContext } from '../contexts/AppContext';
import { generateDispatchDocument } from '../services/geminiService';
import { PROMPT_GERACAO } from '../constants';
import { FaPaperPlane, FaCopy } from 'react-icons/fa';
import { Spinner } from './Spinner';

export const FinalDispatchView: React.FC = () => {
  const {
    structuredExtractedInfo,
    additionalInfo,
    finalDispatchText,
    setFinalDispatchText,
    isLoading,
    setIsLoading,
    setStatusMessage,
    clearStatusMessageAfterDelay,
    currentFile,
    selectedFiscalAuditor // Get selected auditor from context
  } = useAppContext();

  const handleGenerateDispatch = async () => {
    if (Object.keys(structuredExtractedInfo).length === 0) {
      setStatusMessage({ text: 'Primeiro extraia e revise os dados do documento.', type: 'warning' });
      clearStatusMessageAfterDelay();
      return;
    }
    setIsLoading(true);
    setStatusMessage({ text: 'Gerando despacho final com IA...', type: 'info' });
    try {
      const currentDate = new Date().toLocaleDateString('pt-BR');
      const dispatch = await generateDispatchDocument(
        structuredExtractedInfo,
        additionalInfo,
        currentDate,
        PROMPT_GERACAO,
        selectedFiscalAuditor // Pass the selected auditor
      );
      setFinalDispatchText(dispatch);
      setStatusMessage({ text: 'Despacho final gerado com sucesso!', type: 'success' });
      clearStatusMessageAfterDelay();
    } catch (error: any) {
      console.error("Error generating dispatch:", error);
      setStatusMessage({ text: error.message || 'Falha ao gerar despacho final.', type: 'error' });
      // Do not auto-clear error
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyToClipboard = () => {
    if (!finalDispatchText) return;
    navigator.clipboard.writeText(finalDispatchText)
      .then(() => {
        setStatusMessage({ text: 'Despacho copiado para a área de transferência!', type: 'success' });
        clearStatusMessageAfterDelay(3000);
      })
      .catch(err => {
        console.error('Failed to copy text: ', err);
        setStatusMessage({ text: 'Falha ao copiar texto.', type: 'error' });
        clearStatusMessageAfterDelay(3000);
      });
  };

  return (
    <div className="space-y-4">
      <button
        onClick={handleGenerateDispatch}
        disabled={isLoading || Object.keys(structuredExtractedInfo).length === 0 || !currentFile}
        className="w-full flex items-center justify-center px-4 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-green-500 disabled:bg-slate-500 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading && !finalDispatchText ? <Spinner size="sm" color="text-white" className="mr-2"/> : <FaPaperPlane className="mr-2" />}
        Gerar Despacho Final com IA
      </button>
      <div>
        <label htmlFor="final-dispatch-text" className="block text-sm font-medium text-slate-300 mb-1">
          Despacho Final Gerado
        </label>
        <textarea
          id="final-dispatch-text"
          readOnly
          value={finalDispatchText}
          rows={15}
          className="w-full p-3 bg-slate-900 border border-slate-700 rounded-md shadow-sm text-sm text-slate-300 focus:ring-sky-500 focus:border-sky-500 resize-none"
          placeholder="O despacho final gerado pela IA aparecerá aqui..."
        />
      </div>
      {finalDispatchText && (
        <button
          onClick={handleCopyToClipboard}
          disabled={isLoading}
          className="w-full flex items-center justify-center px-4 py-2 border border-slate-600 rounded-md shadow-sm text-sm font-medium text-slate-300 bg-slate-700 hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-sky-500 disabled:opacity-50 transition-colors"
        >
          <FaCopy className="mr-2" />
          Copiar Despacho para Área de Transferência
        </button>
      )}
    </div>
  );
};

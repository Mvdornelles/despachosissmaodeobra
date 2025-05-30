
import React from 'react';
import { useAppContext } from '../contexts/AppContext';
import { FaTimes } from 'react-icons/fa';

export const AdditionalInfoInput: React.FC = () => {
  const { additionalInfo, setAdditionalInfo, isLoading } = useAppContext();

  return (
    <div className="space-y-2">
      <label htmlFor="additional-info-text" className="block text-sm font-medium text-slate-300">
        Informações Adicionais (Opcional)
      </label>
      <textarea
        id="additional-info-text"
        value={additionalInfo}
        onChange={(e) => setAdditionalInfo(e.target.value)}
        rows={5}
        className="w-full p-3 bg-slate-900 border border-slate-700 rounded-md shadow-sm text-sm text-slate-300 focus:ring-sky-500 focus:border-sky-500"
        placeholder="Digite quaisquer observações ou informações complementares aqui..."
        disabled={isLoading}
      />
      <button
        onClick={() => setAdditionalInfo('')}
        disabled={isLoading || !additionalInfo}
        className="mt-2 w-full flex items-center justify-center px-4 py-2 border border-slate-600 rounded-md shadow-sm text-sm font-medium text-slate-300 bg-slate-700 hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-sky-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <FaTimes className="mr-2" />
        Limpar Informações Adicionais
      </button>
    </div>
  );
};
    
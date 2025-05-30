
import React from 'react';
import { useAppContext } from '../contexts/AppContext';

export const FixedTemplateDisplay: React.FC = () => {
  const { dispatchTemplate } = useAppContext();

  return (
    <div className="space-y-2">
      <label htmlFor="fixed-template" className="block text-sm font-medium text-slate-300">
        Modelo Fixo do Despacho (Referência)
      </label>
      <textarea
        id="fixed-template"
        readOnly
        value={dispatchTemplate}
        rows={10}
        className="w-full p-3 bg-slate-900 border border-slate-700 rounded-md shadow-sm text-xs text-slate-400 focus:ring-sky-500 focus:border-sky-500 resize-none"
        placeholder="Modelo do despacho será exibido aqui..."
      />
    </div>
  );
};
    
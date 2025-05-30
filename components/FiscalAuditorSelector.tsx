
import React from 'react';
import { useAppContext } from '../contexts/AppContext';
import { FISCAL_AUDITORS } from '../constants';
import { FaUserTie } from 'react-icons/fa';

export const FiscalAuditorSelector: React.FC = () => {
  const { selectedFiscalAuditor, setSelectedFiscalAuditor, isLoading } = useAppContext();

  return (
    <div className="space-y-2">
      <label htmlFor="fiscal-auditor-select" className="flex items-center text-sm font-medium text-slate-300">
        <FaUserTie className="mr-2 text-sky-400" />
        Selecionar Fiscal Auditor
      </label>
      <select
        id="fiscal-auditor-select"
        value={selectedFiscalAuditor}
        onChange={(e) => setSelectedFiscalAuditor(e.target.value)}
        disabled={isLoading}
        className="w-full p-3 bg-slate-900 border border-slate-700 rounded-md shadow-sm text-sm text-slate-300 focus:ring-sky-500 focus:border-sky-500"
      >
        {FISCAL_AUDITORS.map((auditor) => (
          <option key={auditor} value={auditor}>
            {auditor}
          </option>
        ))}
      </select>
    </div>
  );
};

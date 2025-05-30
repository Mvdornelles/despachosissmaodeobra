
import React, { useEffect } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { FaCheckCircle, FaExclamationTriangle, FaInfoCircle, FaTimesCircle } from 'react-icons/fa';

export const StatusBar: React.FC = () => {
  const { statusMessage, setStatusMessage } = useAppContext();

  useEffect(() => {
    if (statusMessage && statusMessage.type !== 'error') { // Don't auto-clear errors
      const timer = setTimeout(() => {
        setStatusMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusMessage]); // Rerun effect if statusMessage changes

  if (!statusMessage || !statusMessage.text) {
    return null;
  }

  const baseClasses = "fixed top-5 right-5 z-50 p-4 rounded-md shadow-lg text-sm flex items-center space-x-3 max-w-md transition-all duration-300 ease-in-out";
  let typeClasses = "";
  let IconComponent;

  switch (statusMessage.type) {
    case 'success':
      typeClasses = "bg-green-600 text-white";
      IconComponent = FaCheckCircle;
      break;
    case 'error':
      typeClasses = "bg-red-600 text-white";
      IconComponent = FaExclamationTriangle;
      break;
    case 'warning':
      typeClasses = "bg-yellow-500 text-slate-800";
      IconComponent = FaExclamationTriangle;
      break;
    case 'info':
    default:
      typeClasses = "bg-sky-600 text-white";
      IconComponent = FaInfoCircle;
      break;
  }

  return (
    <div className={`${baseClasses} ${typeClasses}`} role="alert">
      {IconComponent && <IconComponent className="h-5 w-5" />}
      <span>{statusMessage.text}</span>
      <button 
        onClick={() => setStatusMessage(null)} 
        className="ml-auto -mx-1.5 -my-1.5 p-1.5 rounded-lg focus:ring-2 focus:ring-white inline-flex h-8 w-8"
        aria-label="Fechar"
      >
        <FaTimesCircle className="h-5 w-5" />
      </button>
    </div>
  );
};
    
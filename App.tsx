import React from 'react';
import { FileUpload } from './components/FileUpload';
import { FixedTemplateDisplay } from './components/FixedTemplateDisplay';
import { ExtractedDataForm } from './components/ExtractedDataForm';
import { AdditionalInfoInput } from './components/AdditionalInfoInput';
import { FinalDispatchView } from './components/FinalDispatchView';
import { StatusBar } from './components/StatusBar';
import { FaBrain, FaSignOutAlt } from 'react-icons/fa';
import { FiscalAuditorSelector } from './components/FiscalAuditorSelector';
import { useAppContext } from './contexts/AppContext';
import { AuthPage } from './pages/AuthPage'; // Import AuthPage
import { Spinner } from './components/Spinner'; // Import Spinner

const App: React.FC = () => {
  const { session, isLoadingAuth, handleSignOut } = useAppContext();

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-700 flex flex-col items-center justify-center p-4">
        <Spinner size="lg" color="text-sky-400" />
        <p className="mt-4 text-sky-300 text-lg">Carregando aplicação...</p>
      </div>
    );
  }

  if (!session) {
    return <AuthPage />;
  }

  // User is authenticated, render the main application
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-700 text-slate-100 p-4 sm:p-6 md:p-8 flex flex-col items-center">
      <header className="w-full max-w-5xl mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <FaBrain className="text-5xl text-sky-400 mr-3" />
            <h1 className="text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-sky-400 to-cyan-300">
              Gerador de Despachos Inteligente
            </h1>
          </div>
          {session && (
             <button
              onClick={handleSignOut}
              className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-red-500 transition-colors"
            >
              <FaSignOutAlt className="mr-2" />
              Sair
            </button>
          )}
        </div>
        <p className="text-slate-400 mt-1">
          Extraia dados, revise e gere documentos oficiais com o poder da IA.
        </p>
      </header>

      <main className="w-full max-w-5xl space-y-8">
        <StatusBar />
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <section id="upload-template" className="space-y-6 p-6 bg-slate-800 rounded-xl shadow-2xl">
            <h2 className="text-2xl font-semibold text-sky-400 border-b-2 border-sky-500 pb-2">1. Documento e Modelo</h2>
            <FileUpload />
            <FixedTemplateDisplay />
          </section>

          <section id="data-extraction" className="space-y-6 p-6 bg-slate-800 rounded-xl shadow-2xl">
            <h2 className="text-2xl font-semibold text-sky-400 border-b-2 border-sky-500 pb-2">2. Extração e Revisão de Dados</h2>
            <ExtractedDataForm />
          </section>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <section id="additional-info-and-auditor" className="p-6 bg-slate-800 rounded-xl shadow-2xl space-y-6">
            <h2 className="text-2xl font-semibold text-sky-400 border-b-2 border-sky-500 pb-2">3. Configurações do Despacho</h2>
            <FiscalAuditorSelector /> 
            <AdditionalInfoInput />
          </section>
        
          <section id="final-dispatch" className="p-6 bg-slate-800 rounded-xl shadow-2xl">
            <h2 className="text-2xl font-semibold text-sky-400 border-b-2 border-sky-500 pb-2">4. Despacho Final</h2>
            <FinalDispatchView />
          </section>
        </div>
      </main>

      <footer className="w-full max-w-5xl mt-12 pt-6 border-t border-slate-700 text-center">
        <p className="text-sm text-slate-500">
          &copy; {new Date().getFullYear()} Gerador de Despachos Inteligente. Autenticado como: {session.user?.email}
        </p>
      </footer>
    </div>
  );
};

export default App;
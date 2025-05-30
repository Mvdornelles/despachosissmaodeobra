
import React from 'react';
import { useAppContext } from '../contexts/AppContext';
import { AuthForm } from '../components/AuthForm';
import { FaBrain } from 'react-icons/fa';

export const AuthPage: React.FC = () => {
  // const [mode, setMode] = useState<'login' | 'signup'>('login'); // Removed mode state
  const { loginWithPassword, /* signUpNewUser, */ isLoadingAuth, authError } = useAppContext(); // signUpNewUser can be kept or removed from context if not used elsewhere

  // const toggleMode = () => { // Removed toggleMode function
  //   setMode(prevMode => (prevMode === 'login' ? 'signup' : 'login'));
  // };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-700 p-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 p-8 sm:p-10 bg-slate-800 rounded-xl shadow-2xl">
        <div className="text-center">
           <FaBrain className="mx-auto text-6xl text-sky-400 mb-4" />
          <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-cyan-300">
            Acessar sua Conta
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Bem-vindo de volta!
          </p>
        </div>

        <AuthForm
          mode="login" // Mode is now fixed to 'login'
          onSubmit={loginWithPassword} // Only login function is needed
          isLoading={isLoadingAuth}
          error={authError}
        />

        {/* Removed the toggle mode button and section 
        <div className="text-center">
          <button
            onClick={toggleMode}
            className="font-medium text-sm text-sky-400 hover:text-sky-300 disabled:opacity-50"
            disabled={isLoadingAuth}
          >
            {mode === 'login' ? 'Não tem uma conta? Registre-se' : 'Já tem uma conta? Faça login'}
          </button>
        </div>
        */}
         <p className="mt-6 text-center text-xs text-slate-500">
            &copy; {new Date().getFullYear()} Gerador de Despachos Inteligente
        </p>
      </div>
    </div>
  );
};

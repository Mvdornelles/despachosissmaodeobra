import React, { createContext, useState, useContext, ReactNode, useCallback, useEffect } from 'react';
import { StatusMessage, ExtractedData, UserCredentials } from '../types';
import { FIXED_DESPACHO_TEMPLATE, FISCAL_AUDITORS } from '../constants';
import { supabase } from '../supabaseClient'; // Import Supabase client
import type { Session, AuthChangeEvent } from '@supabase/supabase-js';

interface AppContextType {
  // Existing state and functions
  rawExtractedText: string;
  setRawExtractedText: (text: string) => void;
  structuredExtractedInfo: ExtractedData;
  setStructuredExtractedInfo: (data: ExtractedData) => void;
  updateStructuredExtractedInfoField: (field: keyof ExtractedData, value: string) => void;
  additionalInfo: string;
  setAdditionalInfo: (info: string) => void;
  finalDispatchText: string;
  setFinalDispatchText: (text: string) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  statusMessage: StatusMessage | null;
  setStatusMessage: (message: StatusMessage | null) => void;
  clearStatusMessageAfterDelay: (delay?: number) => void;
  currentFile: File | null;
  setCurrentFile: (file: File | null) => void;
  dispatchTemplate: string;
  selectedFiscalAuditor: string;
  setSelectedFiscalAuditor: (auditor: string) => void;

  // New auth state and functions
  session: Session | null;
  authError: string | null;
  isLoadingAuth: boolean;
  loginWithPassword: (credentials: UserCredentials) => Promise<void>;
  signUpNewUser: (credentials: UserCredentials) => Promise<void>;
  handleSignOut: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [rawExtractedText, setRawExtractedText] = useState<string>('');
  const [structuredExtractedInfo, setStructuredExtractedInfo] = useState<ExtractedData>({});
  const [additionalInfo, setAdditionalInfo] = useState<string>('');
  const [finalDispatchText, setFinalDispatchText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [selectedFiscalAuditor, setSelectedFiscalAuditor] = useState<string>(FISCAL_AUDITORS[0]);
  const dispatchTemplate = FIXED_DESPACHO_TEMPLATE;

  // Auth state
  const [session, setSession] = useState<Session | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(true); // Start true to check initial session

  const updateStructuredExtractedInfoField = useCallback((field: keyof ExtractedData, value: string) => {
    setStructuredExtractedInfo(prev => ({ ...prev, [field]: value }));
  }, []);
  
  const clearStatusMessageAfterDelay = useCallback((delay: number = 5000) => {
    setTimeout(() => {
      setStatusMessage(null);
    }, delay);
  }, []);

  // Auth functions
  const loginWithPassword = async (credentials: UserCredentials) => {
    setIsLoadingAuth(true);
    setAuthError(null);
    const { error } = await supabase.auth.signInWithPassword(credentials);
    if (error) {
      setAuthError(error.message);
      setStatusMessage({ text: `Erro de login: ${error.message}`, type: 'error' });
    } else {
      setStatusMessage({ text: 'Login realizado com sucesso!', type: 'success' });
      clearStatusMessageAfterDelay();
      // Session will be set by onAuthStateChange
    }
    setIsLoadingAuth(false);
  };

  const signUpNewUser = async (credentials: UserCredentials) => {
    setIsLoadingAuth(true);
    setAuthError(null);
    const { data, error } = await supabase.auth.signUp(credentials);
    if (error) {
      setAuthError(error.message);
      setStatusMessage({ text: `Erro ao registrar: ${error.message}`, type: 'error' });
    } else {
      // Check if user object exists and if email confirmation is needed
      if (data.user && data.user.identities && data.user.identities.length === 0) {
         setStatusMessage({ text: 'Usuário já registrado. Tente fazer login.', type: 'warning' });
      } else if (data.session) {
        // if Supabase returns a session on signup (e.g. auto-confirm is on)
        setStatusMessage({ text: 'Registro e login realizados com sucesso!', type: 'success' });
        clearStatusMessageAfterDelay();
      } else {
         setStatusMessage({ text: 'Registro realizado! Verifique seu e-mail para confirmação.', type: 'info' });
      }
    }
    setIsLoadingAuth(false);
  };

  const handleSignOut = async () => {
    setIsLoadingAuth(true);
    setAuthError(null);
    const { error } = await supabase.auth.signOut();
    if (error) {
      setAuthError(error.message);
      setStatusMessage({ text: `Erro ao sair: ${error.message}`, type: 'error' });
    } else {
      setStatusMessage({ text: 'Você saiu com sucesso.', type: 'info' });
      clearStatusMessageAfterDelay();
      // Session will be cleared by onAuthStateChange
    }
    setIsLoadingAuth(false);
  };
  
  useEffect(() => {
    setIsLoadingAuth(true);
    const getSession = async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setSession(currentSession);
      setIsLoadingAuth(false);
    };
    getSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        setSession(session);
        setIsLoadingAuth(false);
        if (event === 'SIGNED_IN') {
          // Optionally clear other app state or fetch user-specific data
        } else if (event === 'SIGNED_OUT') {
          // Optionally clear app state
          setRawExtractedText('');
          setStructuredExtractedInfo({});
          setAdditionalInfo('');
          setFinalDispatchText('');
          setCurrentFile(null);
        }
      }
    );

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);


  return (
    <AppContext.Provider value={{
      rawExtractedText,
      setRawExtractedText,
      structuredExtractedInfo,
      setStructuredExtractedInfo,
      updateStructuredExtractedInfoField,
      additionalInfo,
      setAdditionalInfo,
      finalDispatchText,
      setFinalDispatchText,
      isLoading,
      setIsLoading,
      statusMessage,
      setStatusMessage,
      clearStatusMessageAfterDelay,
      currentFile,
      setCurrentFile,
      dispatchTemplate,
      selectedFiscalAuditor,
      setSelectedFiscalAuditor,
      // Auth
      session,
      authError,
      isLoadingAuth,
      loginWithPassword,
      signUpNewUser,
      handleSignOut
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = (): AppContextType => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
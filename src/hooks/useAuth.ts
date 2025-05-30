/**
 * Hook de autenticação com Supabase
 * 
 * Este hook gerencia o estado de autenticação do usuário,
 * incluindo login, logout, registro e recuperação de senha.
 */

import { useState, useEffect, useCallback } from 'react';
import { User, AuthError } from '@supabase/supabase-js';
import { supabase } from '../../supabaseClient';
import { logger } from '../utils/logger';
import { errorHandler, AppAuthenticationError, AppError } from '../utils/errorHandler';
import { validateData, UserCredentialsSchema } from '../validators/schemas';
import { AuthState } from './types';

/**
 * Configurações do hook de autenticação
 */
interface UseAuthConfig {
  redirectTo?: string;
  autoRefresh?: boolean;
  persistSession?: boolean;
}

/**
 * Dados de registro de usuário
 */
interface SignUpData {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Hook de autenticação
 */
export function useAuth(config: UseAuthConfig = {}) {
  const {
    redirectTo = '/dashboard',
    autoRefresh = true,
    persistSession = true,
  } = config;

  // Estado da autenticação
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
    error: null,
  });

  /**
   * Atualiza o estado de autenticação
   */
  const updateAuthState = useCallback((updates: Partial<AuthState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  /**
   * Trata erros de autenticação
   */
  const handleAuthError = useCallback(async (error: AuthError | Error): Promise<AppError> => {
    const authError = new AppAuthenticationError(
      error.message,
      {
        component: 'useAuth',
        originalError: error,
      }
    );

    const handledError = await errorHandler.handleError(authError);
    updateAuthState({ error: handledError, isLoading: false });
    
    return handledError;
  }, [updateAuthState]);

  /**
   * Faz login do usuário
   */
  const signIn = useCallback(async (email: string, password: string): Promise<User> => {
    try {
      updateAuthState({ isLoading: true, error: null });

      // Valida credenciais
      const credentials = validateData({ email, password }, UserCredentialsSchema);

      await logger.audit('Tentativa de login', undefined, {
        component: 'useAuth',
        action: 'signIn',
        email,
      });

      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });

      if (error) {
        throw await handleAuthError(error);
      }

      if (!data.user) {
        throw new AppAuthenticationError('Usuário não encontrado após login');
      }

      await logger.audit('Login realizado com sucesso', data.user.id, {
        component: 'useAuth',
        action: 'signIn',
        email,
      });

      updateAuthState({
        user: data.user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      return data.user;
    } catch (error) {
      await logger.error('Erro no login', error as Error, {
        component: 'useAuth',
        action: 'signIn',
        email,
      });
      
      throw error;
    }
  }, [updateAuthState, handleAuthError]);

  /**
   * Registra novo usuário
   */
  const signUp = useCallback(async (userData: SignUpData): Promise<User> => {
    try {
      updateAuthState({ isLoading: true, error: null });

      // Valida dados básicos
      const credentials = validateData(
        { email: userData.email, password: userData.password },
        UserCredentialsSchema
      );

      await logger.audit('Tentativa de registro', undefined, {
        component: 'useAuth',
        action: 'signUp',
        email: userData.email,
      });

      const { data, error } = await supabase.auth.signUp({
        email: credentials.email,
        password: credentials.password,
        options: {
          data: {
            first_name: userData.firstName,
            last_name: userData.lastName,
            ...userData.metadata,
          },
        },
      });

      if (error) {
        throw await handleAuthError(error);
      }

      if (!data.user) {
        throw new AppAuthenticationError('Falha ao criar usuário');
      }

      await logger.audit('Registro realizado com sucesso', data.user.id, {
        component: 'useAuth',
        action: 'signUp',
        email: userData.email,
      });

      updateAuthState({
        user: data.user,
        isAuthenticated: !!data.session,
        isLoading: false,
        error: null,
      });

      return data.user;
    } catch (error) {
      await logger.error('Erro no registro', error as Error, {
        component: 'useAuth',
        action: 'signUp',
        email: userData.email,
      });
      
      throw error;
    }
  }, [updateAuthState, handleAuthError]);

  /**
   * Faz logout do usuário
   */
  const signOut = useCallback(async (): Promise<void> => {
    try {
      updateAuthState({ isLoading: true, error: null });

      const currentUser = state.user;
      
      await logger.audit('Tentativa de logout', currentUser?.id, {
        component: 'useAuth',
        action: 'signOut',
      });

      const { error } = await supabase.auth.signOut();

      if (error) {
        throw await handleAuthError(error);
      }

      await logger.audit('Logout realizado com sucesso', currentUser?.id, {
        component: 'useAuth',
        action: 'signOut',
      });

      updateAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      await logger.error('Erro no logout', error as Error, {
        component: 'useAuth',
        action: 'signOut',
      });
      
      throw error;
    }
  }, [state.user, updateAuthState, handleAuthError]);

  /**
   * Solicita recuperação de senha
   */
  const resetPassword = useCallback(async (email: string): Promise<void> => {
    try {
      updateAuthState({ isLoading: true, error: null });

      // Valida email
      const credentials = validateData({ email, password: 'dummy' }, UserCredentialsSchema);

      await logger.audit('Solicitação de recuperação de senha', undefined, {
        component: 'useAuth',
        action: 'resetPassword',
        email,
      });

      const { error } = await supabase.auth.resetPasswordForEmail(credentials.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        throw await handleAuthError(error);
      }

      await logger.audit('Email de recuperação enviado', undefined, {
        component: 'useAuth',
        action: 'resetPassword',
        email,
      });

      updateAuthState({ isLoading: false, error: null });
    } catch (error) {
      await logger.error('Erro na recuperação de senha', error as Error, {
        component: 'useAuth',
        action: 'resetPassword',
        email,
      });
      
      throw error;
    }
  }, [updateAuthState, handleAuthError]);

  /**
   * Atualiza senha do usuário
   */
  const updatePassword = useCallback(async (newPassword: string): Promise<void> => {
    try {
      updateAuthState({ isLoading: true, error: null });

      // Valida nova senha
      validateData({ email: 'dummy@example.com', password: newPassword }, UserCredentialsSchema);

      await logger.audit('Tentativa de atualização de senha', state.user?.id, {
        component: 'useAuth',
        action: 'updatePassword',
      });

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        throw await handleAuthError(error);
      }

      await logger.audit('Senha atualizada com sucesso', state.user?.id, {
        component: 'useAuth',
        action: 'updatePassword',
      });

      updateAuthState({ isLoading: false, error: null });
    } catch (error) {
      await logger.error('Erro na atualização de senha', error as Error, {
        component: 'useAuth',
        action: 'updatePassword',
      });
      
      throw error;
    }
  }, [state.user?.id, updateAuthState, handleAuthError]);

  /**
   * Atualiza perfil do usuário
   */
  const updateProfile = useCallback(async (updates: Record<string, unknown>): Promise<User> => {
    try {
      updateAuthState({ isLoading: true, error: null });

      await logger.audit('Tentativa de atualização de perfil', state.user?.id, {
        component: 'useAuth',
        action: 'updateProfile',
        updates: Object.keys(updates),
      });

      const { data, error } = await supabase.auth.updateUser({
        data: updates,
      });

      if (error) {
        throw await handleAuthError(error);
      }

      if (!data.user) {
        throw new AppAuthenticationError('Falha ao atualizar perfil');
      }

      await logger.audit('Perfil atualizado com sucesso', data.user.id, {
        component: 'useAuth',
        action: 'updateProfile',
        updates: Object.keys(updates),
      });

      updateAuthState({
        user: data.user,
        isLoading: false,
        error: null,
      });

      return data.user;
    } catch (error) {
      await logger.error('Erro na atualização de perfil', error as Error, {
        component: 'useAuth',
        action: 'updateProfile',
      });
      
      throw error;
    }
  }, [state.user?.id, updateAuthState, handleAuthError]);

  /**
   * Recarrega dados do usuário
   */
  const refreshUser = useCallback(async (): Promise<User | null> => {
    try {
      updateAuthState({ isLoading: true, error: null });

      const { data, error } = await supabase.auth.getUser();

      if (error) {
        throw await handleAuthError(error);
      }

      updateAuthState({
        user: data.user,
        isAuthenticated: !!data.user,
        isLoading: false,
        error: null,
      });

      return data.user;
    } catch (error) {
      await logger.error('Erro ao recarregar usuário', error as Error, {
        component: 'useAuth',
        action: 'refreshUser',
      });
      
      throw error;
    }
  }, [updateAuthState, handleAuthError]);

  /**
   * Limpa erros de autenticação
   */
  const clearError = useCallback(() => {
    updateAuthState({ error: null });
  }, [updateAuthState]);

  /**
   * Verifica se usuário tem permissão específica
   */
  const hasPermission = useCallback((permission: string): boolean => {
    if (!state.user) return false;
    
    const userPermissions = state.user.user_metadata?.permissions as string[] || [];
    return userPermissions.includes(permission);
  }, [state.user]);

  /**
   * Verifica se usuário tem role específico
   */
  const hasRole = useCallback((role: string): boolean => {
    if (!state.user) return false;
    
    const userRole = state.user.user_metadata?.role as string;
    return userRole === role;
  }, [state.user]);

  // Efeito para monitorar mudanças de autenticação
  useEffect(() => {
    let mounted = true;

    // Obtém sessão inicial
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          await handleAuthError(error);
          return;
        }

        if (mounted) {
          updateAuthState({
            user: session?.user || null,
            isAuthenticated: !!session?.user,
            isLoading: false,
            error: null,
          });
        }
      } catch (error) {
        if (mounted) {
          await handleAuthError(error as Error);
        }
      }
    };

    getInitialSession();

    // Escuta mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        await logger.debug(`Auth state changed: ${event}`, {
          component: 'useAuth',
          event,
          hasSession: !!session,
          userId: session?.user?.id,
        });

        updateAuthState({
          user: session?.user || null,
          isAuthenticated: !!session?.user,
          isLoading: false,
          error: null,
        });

        // Log eventos específicos
        if (event === 'SIGNED_IN' && session?.user) {
          await logger.audit('Usuário autenticado', session.user.id, {
            component: 'useAuth',
            event,
          });
        } else if (event === 'SIGNED_OUT') {
          await logger.audit('Usuário desconectado', undefined, {
            component: 'useAuth',
            event,
          });
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [updateAuthState, handleAuthError]);

  return {
    // Estado
    ...state,
    
    // Ações
    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
    updateProfile,
    refreshUser,
    clearError,
    
    // Utilitários
    hasPermission,
    hasRole,
  };
}
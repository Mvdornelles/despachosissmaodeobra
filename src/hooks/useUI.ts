/**
 * Hook para gerenciamento de UI (modais, toasts, etc.)
 * 
 * Este hook centraliza o controle de elementos da interface
 * como modais, toasts, loading states e notificações.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { logger } from '../utils/logger';
import { ModalState, ToastState, ModalConfig, ToastConfig } from './types';

/**
 * Tipos de toast
 */
export type ToastType = 'success' | 'error' | 'warning' | 'info';

/**
 * Configuração do toast
 */
interface ToastOptions {
  type?: ToastType;
  duration?: number;
  persistent?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
  onClose?: () => void;
}

/**
 * Item de toast
 */
interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
  persistent: boolean;
  createdAt: Date;
  action?: {
    label: string;
    onClick: () => void;
  };
  onClose?: () => void;
}

/**
 * Configuração do modal
 */
interface ModalOptions {
  title?: string;
  size?: 'small' | 'medium' | 'large' | 'fullscreen';
  closable?: boolean;
  persistent?: boolean;
  onClose?: () => void;
  onConfirm?: () => void;
  onCancel?: () => void;
}

/**
 * Item de modal
 */
interface ModalItem {
  id: string;
  content: React.ReactNode;
  title?: string;
  size: 'small' | 'medium' | 'large' | 'fullscreen';
  closable: boolean;
  persistent: boolean;
  onClose?: () => void;
  onConfirm?: () => void;
  onCancel?: () => void;
}

/**
 * Estado do UI
 */
interface UIState {
  modals: ModalItem[];
  toasts: ToastItem[];
  isLoading: boolean;
  loadingMessage: string;
  globalError: string | null;
}

/**
 * Hook de gerenciamento de UI
 */
export function useUI() {
  // Estado principal
  const [state, setState] = useState<UIState>({
    modals: [],
    toasts: [],
    isLoading: false,
    loadingMessage: '',
    globalError: null,
  });

  // Referências para timeouts
  const toastTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const toastCounterRef = useRef(0);
  const modalCounterRef = useRef(0);

  /**
   * Gera ID único
   */
  const generateId = useCallback((prefix: string): string => {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  /**
   * Atualiza estado de forma segura
   */
  const updateState = useCallback((updates: Partial<UIState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // ===================
  // GERENCIAMENTO DE TOASTS
  // ===================

  /**
   * Adiciona um toast
   */
  const addToast = useCallback((
    message: string,
    options: ToastOptions = {}
  ): string => {
    const {
      type = 'info',
      duration = 5000,
      persistent = false,
      action,
      onClose,
    } = options;

    const id = generateId('toast');
    const toast: ToastItem = {
      id,
      message,
      type,
      duration,
      persistent,
      createdAt: new Date(),
      action,
      onClose,
    };

    setState(prev => ({
      ...prev,
      toasts: [...prev.toasts, toast],
    }));

    // Configura auto-dismiss se não for persistente
    if (!persistent && duration > 0) {
      const timeout = setTimeout(() => {
        removeToast(id);
      }, duration);
      
      toastTimeoutsRef.current.set(id, timeout);
    }

    logger.debug('Toast adicionado', {
      component: 'useUI',
      action: 'addToast',
      toastId: id,
      type,
      persistent,
      duration,
    });

    return id;
  }, [generateId]);

  /**
   * Remove um toast
   */
  const removeToast = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      toasts: prev.toasts.filter(toast => {
        if (toast.id === id) {
          // Chama callback de close se existir
          if (toast.onClose) {
            toast.onClose();
          }
          return false;
        }
        return true;
      }),
    }));

    // Limpa timeout se existir
    const timeout = toastTimeoutsRef.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      toastTimeoutsRef.current.delete(id);
    }

    logger.debug('Toast removido', {
      component: 'useUI',
      action: 'removeToast',
      toastId: id,
    });
  }, []);

  /**
   * Remove todos os toasts
   */
  const clearToasts = useCallback(() => {
    // Chama callbacks de close
    state.toasts.forEach(toast => {
      if (toast.onClose) {
        toast.onClose();
      }
    });

    // Limpa todos os timeouts
    toastTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
    toastTimeoutsRef.current.clear();

    updateState({ toasts: [] });

    logger.debug('Todos os toasts foram removidos', {
      component: 'useUI',
      action: 'clearToasts',
      count: state.toasts.length,
    });
  }, [state.toasts, updateState]);

  /**
   * Toasts de conveniência
   */
  const showSuccess = useCallback((message: string, options?: Omit<ToastOptions, 'type'>) => {
    return addToast(message, { ...options, type: 'success' });
  }, [addToast]);

  const showError = useCallback((message: string, options?: Omit<ToastOptions, 'type'>) => {
    return addToast(message, { ...options, type: 'error', duration: 8000 });
  }, [addToast]);

  const showWarning = useCallback((message: string, options?: Omit<ToastOptions, 'type'>) => {
    return addToast(message, { ...options, type: 'warning', duration: 6000 });
  }, [addToast]);

  const showInfo = useCallback((message: string, options?: Omit<ToastOptions, 'type'>) => {
    return addToast(message, { ...options, type: 'info' });
  }, [addToast]);

  // ===================
  // GERENCIAMENTO DE MODAIS
  // ===================

  /**
   * Abre um modal
   */
  const openModal = useCallback((
    content: React.ReactNode,
    options: ModalOptions = {}
  ): string => {
    const {
      title,
      size = 'medium',
      closable = true,
      persistent = false,
      onClose,
      onConfirm,
      onCancel,
    } = options;

    const id = generateId('modal');
    const modal: ModalItem = {
      id,
      content,
      title,
      size,
      closable,
      persistent,
      onClose,
      onConfirm,
      onCancel,
    };

    setState(prev => ({
      ...prev,
      modals: [...prev.modals, modal],
    }));

    logger.debug('Modal aberto', {
      component: 'useUI',
      action: 'openModal',
      modalId: id,
      size,
      closable,
      persistent,
    });

    return id;
  }, [generateId]);

  /**
   * Fecha um modal
   */
  const closeModal = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      modals: prev.modals.filter(modal => {
        if (modal.id === id) {
          // Chama callback de close se existir
          if (modal.onClose) {
            modal.onClose();
          }
          return false;
        }
        return true;
      }),
    }));

    logger.debug('Modal fechado', {
      component: 'useUI',
      action: 'closeModal',
      modalId: id,
    });
  }, []);

  /**
   * Fecha o modal mais recente
   */
  const closeTopModal = useCallback(() => {
    if (state.modals.length > 0) {
      const topModal = state.modals[state.modals.length - 1];
      if (topModal.closable) {
        closeModal(topModal.id);
      }
    }
  }, [state.modals, closeModal]);

  /**
   * Fecha todos os modais
   */
  const closeAllModals = useCallback(() => {
    // Chama callbacks de close
    state.modals.forEach(modal => {
      if (modal.onClose) {
        modal.onClose();
      }
    });

    updateState({ modals: [] });

    logger.debug('Todos os modais foram fechados', {
      component: 'useUI',
      action: 'closeAllModals',
      count: state.modals.length,
    });
  }, [state.modals, updateState]);

  /**
   * Confirma o modal mais recente
   */
  const confirmTopModal = useCallback(() => {
    if (state.modals.length > 0) {
      const topModal = state.modals[state.modals.length - 1];
      if (topModal.onConfirm) {
        topModal.onConfirm();
      }
      closeModal(topModal.id);
    }
  }, [state.modals, closeModal]);

  /**
   * Cancela o modal mais recente
   */
  const cancelTopModal = useCallback(() => {
    if (state.modals.length > 0) {
      const topModal = state.modals[state.modals.length - 1];
      if (topModal.onCancel) {
        topModal.onCancel();
      }
      closeModal(topModal.id);
    }
  }, [state.modals, closeModal]);

  // ===================
  // GERENCIAMENTO DE LOADING
  // ===================

  /**
   * Mostra loading global
   */
  const showLoading = useCallback((message = 'Carregando...') => {
    updateState({
      isLoading: true,
      loadingMessage: message,
    });

    logger.debug('Loading global ativado', {
      component: 'useUI',
      action: 'showLoading',
      message,
    });
  }, [updateState]);

  /**
   * Esconde loading global
   */
  const hideLoading = useCallback(() => {
    updateState({
      isLoading: false,
      loadingMessage: '',
    });

    logger.debug('Loading global desativado', {
      component: 'useUI',
      action: 'hideLoading',
    });
  }, [updateState]);

  // ===================
  // GERENCIAMENTO DE ERROS GLOBAIS
  // ===================

  /**
   * Mostra erro global
   */
  const showGlobalError = useCallback((error: string) => {
    updateState({ globalError: error });

    logger.error('Erro global definido', new Error(error), {
      component: 'useUI',
      action: 'showGlobalError',
    });
  }, [updateState]);

  /**
   * Limpa erro global
   */
  const clearGlobalError = useCallback(() => {
    updateState({ globalError: null });

    logger.debug('Erro global limpo', {
      component: 'useUI',
      action: 'clearGlobalError',
    });
  }, [updateState]);

  // ===================
  // MODAIS DE CONVENIÊNCIA
  // ===================

  /**
   * Modal de confirmação
   */
  const showConfirmDialog = useCallback((
    message: string,
    onConfirm: () => void,
    onCancel?: () => void,
    title = 'Confirmação'
  ): string => {
    const content = (
      <div className="confirm-dialog">
        <p>{message}</p>
        <div className="confirm-dialog-actions">
          <button 
            onClick={() => {
              onConfirm();
              closeTopModal();
            }}
            className="btn btn-primary"
          >
            Confirmar
          </button>
          <button 
            onClick={() => {
              if (onCancel) onCancel();
              closeTopModal();
            }}
            className="btn btn-secondary"
          >
            Cancelar
          </button>
        </div>
      </div>
    );

    return openModal(content, {
      title,
      size: 'small',
      closable: true,
      onConfirm,
      onCancel,
    });
  }, [openModal, closeTopModal]);

  /**
   * Modal de alerta
   */
  const showAlert = useCallback((
    message: string,
    onClose?: () => void,
    title = 'Aviso'
  ): string => {
    const content = (
      <div className="alert-dialog">
        <p>{message}</p>
        <div className="alert-dialog-actions">
          <button 
            onClick={() => {
              if (onClose) onClose();
              closeTopModal();
            }}
            className="btn btn-primary"
          >
            OK
          </button>
        </div>
      </div>
    );

    return openModal(content, {
      title,
      size: 'small',
      closable: true,
      onClose,
    });
  }, [openModal, closeTopModal]);

  // Cleanup no unmount
  useEffect(() => {
    return () => {
      // Limpa todos os timeouts de toast
      toastTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
      toastTimeoutsRef.current.clear();
    };
  }, []);

  return {
    // Estado
    ...state,
    
    // Toasts
    addToast,
    removeToast,
    clearToasts,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    
    // Modais
    openModal,
    closeModal,
    closeTopModal,
    closeAllModals,
    confirmTopModal,
    cancelTopModal,
    showConfirmDialog,
    showAlert,
    
    // Loading
    showLoading,
    hideLoading,
    
    // Erros globais
    showGlobalError,
    clearGlobalError,
    
    // Utilitários
    hasModals: state.modals.length > 0,
    hasToasts: state.toasts.length > 0,
    topModal: state.modals.length > 0 ? state.modals[state.modals.length - 1] : null,
    toastCount: state.toasts.length,
    modalCount: state.modals.length,
  };
}
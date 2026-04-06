import { useState, useCallback } from 'react';

interface ModalConfig {
  title: string;
  message: string;
  type?: 'info' | 'warning' | 'error' | 'success' | 'confirm';
  confirmText?: string;
  cancelText?: string;
  showCancel?: boolean;
  onConfirm?: () => void;
}

export const useCustomModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<ModalConfig>({
    title: '',
    message: '',
    type: 'info'
  });

  const showModal = useCallback((modalConfig: ModalConfig) => {
    setConfig(modalConfig);
    setIsOpen(true);
  }, []);

  const hideModal = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Convenience methods for different types of modals
  const showInfo = useCallback((title: string, message: string) => {
    showModal({ title, message, type: 'info' });
  }, [showModal]);

  const showWarning = useCallback((title: string, message: string) => {
    showModal({ title, message, type: 'warning' });
  }, [showModal]);

  const showError = useCallback((title: string, message: string) => {
    showModal({ title, message, type: 'error' });
  }, [showModal]);

  const showSuccess = useCallback((title: string, message: string) => {
    showModal({ title, message, type: 'success' });
  }, [showModal]);

  const showConfirm = useCallback((
    title: string, 
    message: string, 
    onConfirm: () => void,
    confirmText = 'Confirm',
    cancelText = 'Cancel'
  ) => {
    showModal({ 
      title, 
      message, 
      type: 'confirm', 
      onConfirm, 
      confirmText, 
      cancelText, 
      showCancel: true 
    });
  }, [showModal]);

  return {
    isOpen,
    config,
    showModal,
    hideModal,
    showInfo,
    showWarning,
    showError,
    showSuccess,
    showConfirm
  };
};

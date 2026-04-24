import { useState, useCallback } from 'react';

export function useToastConfirm() {
  const [toasts, setToasts] = useState([]);
  const [confirmConfig, setConfirmConfig] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
    isDanger: false,
  });

  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev.slice(-4), { id, message, type }]); // Keep last 5
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const requestConfirm = useCallback((title, message, isDanger = false) => {
    return new Promise((resolve) => {
      setConfirmConfig({
        isOpen: true,
        title,
        message,
        isDanger,
        onConfirm: () => {
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
          resolve(true);
        },
        onCancel: () => {
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
          resolve(false);
        }
      });
    });
  }, []);

  return {
    toasts,
    showToast,
    removeToast,
    confirmConfig,
    requestConfirm,
  };
}

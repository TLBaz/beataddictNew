import { useState, useEffect } from 'react';

type ToastType = 'default' | 'destructive';

interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: ToastType;
}

const toastListeners = new Set<(toasts: Toast[]) => void>();
let toastsList: Toast[] = [];

const notify = () => {
  toastListeners.forEach(listener => listener([...toastsList]));
};

export const useToast = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    toastListeners.add(setToasts);
    return () => {
      toastListeners.delete(setToasts);
    };
  }, []);

  const toast = ({ title, description, variant = 'default' }: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(7);
    const newToast = { id, title, description, variant };
    
    toastsList = [...toastsList, newToast];
    notify();

    setTimeout(() => {
      toastsList = toastsList.filter(t => t.id !== id);
      notify();
    }, 5000);
  };

  return { toast, toasts };
};

import { create } from 'zustand';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

interface ConfirmOptions {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

interface ToastState {
  toasts: Toast[];
  confirm: ConfirmOptions | null;
  showToast: (message: string, type?: Toast['type']) => void;
  hideToast: (id: string) => void;
  showConfirm: (options: ConfirmOptions) => void;
  hideConfirm: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  confirm: null,
  showToast: (message, type = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({
      toasts: [...state.toasts, { id, message, type }]
    }));
    // Auto-remove toast after 3.5 seconds
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id)
      }));
    }, 3500);
  },
  hideToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id)
    })),
  showConfirm: (options) => set({ confirm: options }),
  hideConfirm: () => set({ confirm: null })
}));

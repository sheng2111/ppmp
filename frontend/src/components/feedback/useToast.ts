import { useCallback, useRef, useState } from "react";

export type ToastType = "success" | "error" | "warning" | "info" | "loading";

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration: number;
}

interface ToastOptions {
  duration?: number;
}

const DEFAULT_DURATIONS: Record<ToastType, number> = {
  success: 4000,
  error: 6000,
  warning: 5000,
  info: 4000,
  loading: Infinity, // manual dismiss only
};

let toastCounter = 0;

/**
 * Hook for dispatching toasts. Used inside ToastProvider.
 * Exposes toast.success(), toast.error(), toast.warning(), toast.info().
 */
export function useToastState() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (type: ToastType, message: string, options?: ToastOptions) => {
      const id = `toast-${++toastCounter}`;
      const duration = options?.duration ?? DEFAULT_DURATIONS[type];

      const toast: Toast = { id, type, message, duration };
      setToasts((prev) => {
        // Max 3 visible — drop oldest if exceeded
        const next = [...prev, toast];
        return next.length > 3 ? next.slice(next.length - 3) : next;
      });

      if (duration !== Infinity) {
        const timer = setTimeout(() => dismiss(id), duration);
        timersRef.current.set(id, timer);
      }

      return id;
    },
    [dismiss],
  );

  const toast = {
    success: (message: string, options?: ToastOptions) =>
      addToast("success", message, options),
    error: (message: string, options?: ToastOptions) =>
      addToast("error", message, options),
    warning: (message: string, options?: ToastOptions) =>
      addToast("warning", message, options),
    info: (message: string, options?: ToastOptions) =>
      addToast("info", message, options),
    loading: (message: string, options?: ToastOptions) =>
      addToast("loading", message, options),
    dismiss,
  };

  return { toasts, toast, dismiss };
}

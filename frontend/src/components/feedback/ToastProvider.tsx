import React, { createContext, useContext } from "react";
import {
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Info,
  Loader2,
  X,
} from "lucide-react";
import { colors } from "../../pages/admin/theme";
import { useToastState } from "./useToast";
import type { Toast, ToastType } from "./useToast";

interface ToastContextValue {
  toast: {
    success: (message: string, options?: { duration?: number }) => string;
    error: (message: string, options?: { duration?: number }) => string;
    warning: (message: string, options?: { duration?: number }) => string;
    info: (message: string, options?: { duration?: number }) => string;
    loading: (message: string, options?: { duration?: number }) => string;
    dismiss: (id: string) => void;
  };
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue["toast"] {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx.toast;
}

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="w-5 h-5" style={{ color: colors.success }} />,
  error: <AlertCircle className="w-5 h-5" style={{ color: colors.error }} />,
  warning: <AlertTriangle className="w-5 h-5" style={{ color: colors.warning }} />,
  info: <Info className="w-5 h-5" style={{ color: colors.primary }} />,
  loading: <Loader2 className="w-5 h-5 animate-spin" style={{ color: colors.primary }} />,
};

const BG_COLORS: Record<ToastType, string> = {
  success: colors.successBg,
  error: colors.errorBg,
  warning: colors.warningBg,
  info: colors.activeBg,
  loading: "#FFFFFF",
};

const BORDER_COLORS: Record<ToastType, string> = {
  success: colors.successBorder,
  error: colors.errorBorder,
  warning: colors.warningBorder,
  info: colors.activeBorder,
  loading: colors.border,
};

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  return (
    <div
      role="status"
      aria-live={toast.type === "error" ? "assertive" : "polite"}
      className="flex items-start gap-3 p-4 rounded-xl shadow-lg border w-full animate-[toastIn_200ms_ease-out]"
      style={{
        background: BG_COLORS[toast.type],
        borderColor: BORDER_COLORS[toast.type],
      }}
      onMouseEnter={() => {
        /* pause auto-dismiss — timer managed by useToast */
      }}
    >
      <div className="shrink-0 mt-0.5">{ICONS[toast.type]}</div>
      <p
        className="flex-1 text-sm leading-snug"
        style={{ color: colors.text }}
      >
        {toast.message}
      </p>
      <button
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="shrink-0 p-0.5 rounded-md transition-colors hover:bg-black/5"
        style={{ color: colors.textFaint }}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { toasts, toast, dismiss } = useToastState();

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast region — top-right on desktop, full-width on mobile */}
      <div
        aria-label="Notifications"
        className="fixed z-[100] flex flex-col gap-2 p-4 pointer-events-none
                   top-5 right-5 w-[360px]
                   max-sm:inset-x-4 max-sm:top-4 max-sm:w-auto"
      >
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

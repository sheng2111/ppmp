import React, { useEffect, useRef } from "react";
import { AlertTriangle, AlertCircle, Info } from "lucide-react";
import { colors } from "../../pages/admin/theme";
import type { ConfirmState, ConfirmTone } from "./useConfirm";
import { LoadingButton } from "./LoadingButton";

const TONE_CONFIG: Record<
  ConfirmTone,
  { icon: React.ReactNode; bg: string; border: string; buttonVariant: "destructive" | "primary" }
> = {
  danger: {
    icon: <AlertCircle className="w-5 h-5" style={{ color: colors.error }} />,
    bg: colors.errorBg,
    border: colors.errorBorder,
    buttonVariant: "destructive",
  },
  warning: {
    icon: <AlertTriangle className="w-5 h-5" style={{ color: colors.warning }} />,
    bg: colors.warningBg,
    border: colors.warningBorder,
    buttonVariant: "primary",
  },
  primary: {
    icon: <Info className="w-5 h-5" style={{ color: colors.primary }} />,
    bg: colors.activeBg,
    border: colors.activeBorder,
    buttonVariant: "primary",
  },
};

interface ConfirmDialogProps {
  state: ConfirmState | null;
  onConfirm: () => void;
  onCancel: () => void;
  processing?: boolean;
}

export function ConfirmDialog({
  state,
  onConfirm,
  onCancel,
  processing = false,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Focus trap + restore on close
  useEffect(() => {
    if (state) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      dialogRef.current?.focus();
    } else {
      previousFocusRef.current?.focus();
    }
  }, [state]);

  // Escape key — close as Cancel unless processing
  useEffect(() => {
    if (!state) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !processing) {
        onCancel();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [state, processing, onCancel]);

  if (!state) return null;

  const tone = TONE_CONFIG[(state.tone ?? "danger") as ConfirmTone];

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      {/* Scrim */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={processing ? undefined : onCancel}
      />
      {/* Dialog */}
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-desc"
        tabIndex={-1}
        className="relative bg-white rounded-xl shadow-2xl border w-full max-w-[420px] p-6 outline-none animate-[dialogIn_180ms_ease-out]"
        style={{ borderColor: colors.border }}
      >
        <div className="flex items-start gap-3 mb-4">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: tone.bg }}
          >
            {tone.icon}
          </div>
          <div className="min-w-0">
            <h2
              id="confirm-title"
              className="text-base font-semibold"
              style={{ color: colors.text, fontFamily: colors.text }}
            >
              {state.title}
            </h2>
          </div>
        </div>
        <p
          id="confirm-desc"
          className="text-sm mb-6 leading-relaxed"
          style={{ color: colors.textMuted }}
        >
          {state.description}
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={processing}
            className="px-4 py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-50"
            style={{
              color: colors.textMuted,
              border: `1px solid ${colors.border}`,
              background: "transparent",
            }}
          >
            Cancel
          </button>
          <LoadingButton
            onClick={onConfirm}
            busy={processing}
            busyLabel={processing ? `${state.confirmLabel}...` : undefined}
            variant={tone.buttonVariant}
          >
            {state.confirmLabel}
          </LoadingButton>
        </div>
      </div>
    </div>
  );
}

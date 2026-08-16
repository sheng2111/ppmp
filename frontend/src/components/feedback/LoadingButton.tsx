import React from "react";
import { Loader2 } from "lucide-react";
import { colors } from "../../pages/admin/theme";

interface LoadingButtonProps {
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
  busyLabel?: string;
  variant?: "primary" | "secondary" | "destructive" | "ghost";
  className?: string;
  children: React.ReactNode;
}

/**
 * Thin wrapper around the existing PrimaryButton pattern from
 * SignatorySettingsPage.tsx. Adds a spinner glyph + busy label while
 * the async operation is in flight. Follows the §G state machine:
 * Idle → Processing (spinner + disabled) → back to Idle on settle.
 */
export function LoadingButton({
  onClick,
  disabled = false,
  busy = false,
  busyLabel,
  variant = "primary",
  className = "",
  children,
}: LoadingButtonProps) {
  const isDisabled = disabled || busy;

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: { background: colors.primary, color: "#FFFFFF" },
    secondary: {
      background: "transparent",
      color: colors.textMuted,
      border: `1px solid ${colors.border}`,
    },
    destructive: { background: colors.error, color: "#FFFFFF" },
    ghost: { background: "transparent", color: colors.textMuted },
  };

  const baseStyle: React.CSSProperties = {
    ...variantStyles[variant],
    opacity: isDisabled ? 0.5 : 1,
    cursor: isDisabled ? "not-allowed" : "pointer",
  };

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition disabled:cursor-not-allowed ${className}`}
      style={baseStyle}
      onMouseEnter={(e) => {
        if (!isDisabled && variant === "primary") {
          e.currentTarget.style.background = colors.primaryHover;
        }
      }}
      onMouseLeave={(e) => {
        if (variant === "primary") {
          e.currentTarget.style.background = colors.primary;
        }
      }}
    >
      {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      {busy ? (busyLabel ?? "Saving...") : children}
    </button>
  );
}

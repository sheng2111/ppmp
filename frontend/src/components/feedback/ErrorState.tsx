import { AlertCircle } from "lucide-react";
import { colors } from "../../pages/admin/theme";

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

/**
 * Error display for full-section/card failures. Shows a friendly
 * message with an optional retry button. Never renders raw error text.
 */
export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
}: ErrorStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center py-12 px-6 text-center rounded-xl"
      style={{ background: colors.errorBg, border: `1px solid ${colors.errorBorder}` }}
    >
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
        style={{ background: "#FEE2E2" }}
      >
        <AlertCircle className="w-6 h-6" style={{ color: colors.error }} />
      </div>
      <h3
        className="text-sm font-semibold mb-1"
        style={{ color: colors.text }}
      >
        {title}
      </h3>
      <p
        className="text-[13px] max-w-sm mb-4"
        style={{ color: colors.textMuted }}
      >
        {message}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 rounded-xl text-sm font-medium transition hover:opacity-90"
          style={{
            background: "transparent",
            color: colors.error,
            border: `1px solid ${colors.errorBorder}`,
          }}
        >
          Try again
        </button>
      )}
    </div>
  );
}

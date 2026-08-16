import React from "react";
import { Inbox } from "lucide-react";
import { colors } from "../../pages/admin/theme";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Renders when a list is empty. Shows an icon, title, description,
 * and an optional action button (only shown when the user's role
 * permits the action — caller decides whether to pass action).
 */
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: colors.fieldBg }}
      >
        {icon ?? <Inbox className="w-8 h-8" style={{ color: colors.textFaint }} />}
      </div>
      <h3
        className="text-[15px] font-semibold mb-1"
        style={{ color: colors.text }}
      >
        {title}
      </h3>
      <p
        className="text-[13px] max-w-sm mb-5"
        style={{ color: colors.textMuted }}
      >
        {description}
      </p>
      {action && (
        <button
          onClick={action.onClick}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
          style={{ background: colors.primary }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

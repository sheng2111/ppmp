import { useEffect, useCallback, useRef } from "react";

type ConfirmFn = (opts: {
  title: string;
  description: string;
  confirmLabel: string;
  tone: "danger" | "warning" | "primary";
}) => Promise<boolean>;

/**
 * Warns before browser close/refresh and in-app navigation when
 * the form has unsaved changes. Uses the browser's beforeunload
 * event for refresh/close, and a custom ConfirmDialog for in-app
 * navigation (tab switches, route changes).
 *
 * @param isDirty - whether the current form has unsaved changes
 * @param confirm - optional custom confirm function (from useConfirm).
 *   Falls back to window.confirm if not provided.
 */
export function useUnsavedChangesGuard(
  isDirty: boolean,
  confirm?: ConfirmFn,
) {
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  // Browser refresh / close — native beforeunload (can't be customized)
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  /**
   * Call before any in-app navigation. Returns true if navigation
   * should proceed, false if the user chose to stay.
   */
  const guardNavigation = useCallback(
    async (): Promise<boolean> => {
      if (!isDirtyRef.current) return true;

      if (confirm) {
        return confirm({
          title: "Unsaved changes",
          description:
            "You have unsaved changes that will be lost if you leave this page.",
          confirmLabel: "Leave Page",
          tone: "danger",
        });
      }

      // Fallback to native confirm
      return window.confirm(
        "You have unsaved changes that will be lost if you leave this page.",
      );
    },
    [confirm],
  );

  return { guardNavigation };
}

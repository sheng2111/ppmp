import { useCallback, useRef, useState } from "react";

export type ConfirmTone = "danger" | "warning" | "primary";

export interface ConfirmOptions {
  title: string;
  description: string;
  confirmLabel: string;
  tone?: ConfirmTone;
}

export interface ConfirmState extends ConfirmOptions {
  id: number;
  resolve: (result: boolean) => void;
}

let confirmCounter = 0;

/**
 * Imperative confirm hook. Usage:
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title: "Delete?", ... }))) return;
 */
export function useConfirmState() {
  const [state, setState] = useState<ConfirmState | null>(null);
  const resolveRef = useRef<(result: boolean) => void>(() => {});

  const confirm = useCallback(
    (options: ConfirmOptions): Promise<boolean> => {
      return new Promise<boolean>((resolve) => {
        resolveRef.current = resolve;
        setState({ ...options, id: ++confirmCounter, resolve });
      });
    },
    [],
  );

  const handleConfirm = useCallback(() => {
    state?.resolve(true);
    setState(null);
  }, [state]);

  const handleCancel = useCallback(() => {
    state?.resolve(false);
    setState(null);
  }, [state]);

  return {
    confirmState: state,
    confirm,
    handleConfirm,
    handleCancel,
  };
}

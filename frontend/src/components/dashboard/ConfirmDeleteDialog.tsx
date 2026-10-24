import React from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';

export interface ConfirmDeleteDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDeleting?: boolean;
  errorMessage?: string | null;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
  testId?: string;
}

export const ConfirmDeleteDialog: React.FC<ConfirmDeleteDialogProps> = ({
  isOpen,
  title,
  description,
  confirmLabel = 'Excluir Definitivamente',
  cancelLabel = 'Cancelar',
  isDeleting = false,
  errorMessage = null,
  onConfirm,
  onClose,
  testId = 'dialog-confirm-delete',
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid={testId}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/40 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-card-border bg-card p-6 shadow-2xl text-foreground">
        <button
          onClick={onClose}
          disabled={isDeleting}
          aria-label="Fechar"
          className="absolute right-4 top-4 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition disabled:opacity-50"
        >
          <X className="size-5" />
        </button>

        <div className="flex items-center gap-3 text-destructive">
          <div className="p-2.5 rounded-xl bg-destructive/15">
            <AlertTriangle className="size-6 text-destructive" />
          </div>
          <div>
            <h3 className="text-lg font-bold">{title}</h3>
            <p className="text-xs text-muted-foreground">Esta ação não pode ser desfeita.</p>
          </div>
        </div>

        <p className="mt-3 text-sm text-foreground/80 leading-relaxed">{description}</p>

        {errorMessage && (
          <div
            role="alert"
            className="mt-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive font-semibold flex items-center gap-2"
          >
            <AlertTriangle className="size-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            data-testid="button-cancel-delete"
            className="rounded-xl border border-input bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted transition disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            data-testid="button-confirm-delete"
            className="rounded-xl bg-destructive text-destructive-foreground font-bold px-4 py-2 text-xs transition hover:brightness-110 disabled:opacity-50 flex items-center gap-2"
          >
            {isDeleting && <Loader2 className="size-3.5 animate-spin" />}
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

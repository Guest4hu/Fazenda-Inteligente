import React, { useState, useEffect } from 'react';
import { X, Tractor, AlertCircle, Loader2 } from 'lucide-react';
import { farmService } from '../../services/farmService';
import { useFarmCorral } from '../../context/FarmCorralContext';
import { ApiError } from '../../services/apiClient';
import type { FarmResponseDTO } from '../../types/api';

export interface FarmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  mode?: 'create' | 'edit';
  farmToEdit?: FarmResponseDTO | null;
}

/**
 * Modal dialog for creating or editing a farm, supporting standalone rendering
 * outside {@code FarmCorralContext} and mapping RFC 7807 validation/conflict
 * responses onto form fields.
 */
export const FarmModal: React.FC<FarmModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  mode = 'create',
  farmToEdit = null,
}) => {
  let farmCorral: ReturnType<typeof useFarmCorral> | null = null;
  try {
    farmCorral = useFarmCorral();
  } catch {
    // rendered outside provider
  }
  const addFarm = farmCorral?.addFarm || (() => {});
  const updateFarmInContext = farmCorral?.updateFarmInContext;

  const [name, setName] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEdit = mode === 'edit' && Boolean(farmToEdit);

  useEffect(() => {
    if (isOpen) {
      setName(isEdit && farmToEdit ? farmToEdit.name : '');
      setFieldError(null);
      setGeneralError(null);
    }
  }, [isOpen, isEdit, farmToEdit]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldError(null);
    setGeneralError(null);

    const trimmed = name.trim();
    if (!trimmed) {
      setFieldError('O nome da fazenda é obrigatório.');
      return;
    }
    if (trimmed.length < 2) {
      setFieldError('O nome da fazenda deve ter pelo menos 2 caracteres.');
      return;
    }
    if (trimmed.length > 100) {
      setFieldError('O nome da fazenda não pode exceder 100 caracteres.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEdit && farmToEdit) {
        const updated = await farmService.updateFarm(farmToEdit.id, { name: trimmed });
        if (updateFarmInContext) updateFarmInContext(updated);
      } else {
        const created = await farmService.createFarm({ name: trimmed });
        addFarm(created);
      }
      setName('');
      onSuccess?.();
      onClose();
    } catch (err: any) {
      if (err instanceof ApiError) {
        if (err.invalidParams?.name) {
          setFieldError(err.invalidParams.name);
        } else if (err.status === 409) {
          setGeneralError(err.detail || 'Você já possui uma fazenda com este nome.');
        } else {
          setGeneralError(err.detail || err.title || (isEdit ? 'Falha ao atualizar fazenda.' : 'Falha ao cadastrar fazenda.'));
        }
      } else {
        setGeneralError(err?.message || 'Erro inesperado.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="farm-modal-title"
      data-testid="modal-farm"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/40 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-card-border bg-card p-6 shadow-xl text-foreground">
        <button
          onClick={onClose}
          data-testid="button-farm-close"
          aria-label="Fechar"
          className="absolute right-4 top-4 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition"
        >
          <X className="size-5" />
        </button>

        <div className="flex items-center gap-2 text-primary">
          <Tractor className="size-6" />
          <h2 id="farm-modal-title" className="text-xl font-extrabold tracking-tight">
            {isEdit ? 'Editar Fazenda' : 'Nova Fazenda'}
          </h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {isEdit
            ? 'Atualize o nome da fazenda cadastrada.'
            : 'Cadastre uma nova propriedade para agrupar currais e gerenciar seus rebanhos.'}
        </p>

        {generalError && (
          <div
            role="alert"
            data-testid="alert-farm-error"
            className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive font-medium flex items-start gap-2"
          >
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <span>{generalError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="farm-name"
              className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1"
            >
              Nome da Fazenda
            </label>
            <input
              id="farm-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (fieldError) setFieldError(null);
                if (generalError) setGeneralError(null);
              }}
              data-testid="input-farm-name"
              placeholder="Ex: Fazenda Santa Luzia"
              disabled={isSubmitting}
              className={`w-full rounded-xl border-2 bg-background px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring ${
                fieldError ? 'border-destructive text-destructive' : 'border-input text-foreground'
              }`}
            />
            {fieldError && (
              <p
                data-testid="error-farm-name"
                className="mt-1 text-xs font-semibold text-destructive flex items-center gap-1"
              >
                <AlertCircle className="size-3.5 shrink-0" />
                {fieldError}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              data-testid="button-farm-cancel"
              disabled={isSubmitting}
              className="rounded-xl border border-input bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              data-testid="button-farm-submit"
              className="rounded-xl bg-primary text-primary-foreground font-bold px-4 py-2 text-xs transition hover:brightness-110 disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
              <span>{isEdit ? 'Salvar Alterações' : 'Cadastrar Fazenda'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { X, Fence, AlertCircle, Loader2 } from 'lucide-react';
import { corralService } from '../../services/corralService';
import { sanitizeMacAddress } from '../../services/macUtils';
import { useFarmCorral } from '../../context/FarmCorralContext';
import { ApiError } from '../../services/apiClient';
import type { CorralResponseDTO } from '../../types/api';

export interface CorralModalProps {
  isOpen: boolean;
  farmId: number;
  onClose: () => void;
  onSuccess?: () => void;
  mode?: 'create' | 'edit';
  corralToEdit?: CorralResponseDTO | null;
}

/**
 * Modal dialog for creating or editing a corral, supporting standalone usage
 * outside {@code FarmCorralContext}, client-side MAC/interval/odor validation,
 * {@code HH:mm} to {@code HH:mm:ss} time formatting, and RFC 7807 error mapping.
 */
export const CorralModal: React.FC<CorralModalProps> = ({
  isOpen,
  farmId,
  onClose,
  onSuccess,
  mode = 'create',
  corralToEdit = null,
}) => {
  let farmCorral: ReturnType<typeof useFarmCorral> | null = null;
  try {
    farmCorral = useFarmCorral();
  } catch {
    // rendered outside provider
  }
  const addCorral = farmCorral?.addCorral || (() => {});
  const updateCorralInContext = farmCorral?.updateCorralInContext || (() => {});

  const isEdit = mode === 'edit' && Boolean(corralToEdit);

  const [name, setName] = useState('');
  const [macAddress, setMacAddress] = useState('');
  const [cleanTime, setCleanTime] = useState('06:30');
  const [limitOdor, setLimitOdor] = useState('400');
  const [pumpDurationSeconds, setPumpDurationSeconds] = useState('30');

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (isEdit && corralToEdit) {
        setName(corralToEdit.name);
        setMacAddress(corralToEdit.macAddress);
        setCleanTime(corralToEdit.cleanTime ? corralToEdit.cleanTime.substring(0, 5) : '');
        setLimitOdor(String(corralToEdit.limitOdor ?? 400));
        setPumpDurationSeconds(String(corralToEdit.pumpDurationSeconds ?? 30));
      } else {
        setName('');
        setMacAddress('');
        setCleanTime('06:30');
        setLimitOdor('400');
        setPumpDurationSeconds('30');
      }
      setFieldErrors({});
      setGeneralError(null);
    }
  }, [isOpen, isEdit, corralToEdit]);

  if (!isOpen) return null;

  /** Validates form fields and normalizes the ESP32 MAC address before submission. */
  const validateClientSide = (): { valid: boolean; sanitizedMac: string } => {
    const errors: Record<string, string> = {};
    let sanitized = '';

    if (!name.trim()) {
      errors.name = 'O nome do curral é obrigatório.';
    } else if (name.trim().length < 2 || name.trim().length > 100) {
      errors.name = 'O nome deve ter entre 2 e 100 caracteres.';
    }

    if (!macAddress.trim()) {
      errors.macAddress = 'O MAC Address do ESP32 é obrigatório.';
    } else {
      try {
        sanitized = sanitizeMacAddress(macAddress);
      } catch {
        errors.macAddress = 'MAC Address deve ter 12 dígitos hexadecimais (ex: 240AC4000110).';
      }
    }

    if (cleanTime && !/^\d{2}:\d{2}(:\d{2})?$/.test(cleanTime)) {
      errors.cleanTime = 'Formato de horário inválido (HH:mm ou HH:mm:ss).';
    }

    const odorNum = Number(limitOdor);
    if (isNaN(odorNum) || odorNum < 0) {
      errors.limitOdor = 'O limite de odor deve ser um número não negativo.';
    }

    const durationNum = Number(pumpDurationSeconds);
    if (isNaN(durationNum) || durationNum < 1 || durationNum > 60) {
      errors.pumpDurationSeconds = 'A duração da bomba deve estar entre 1 e 60 segundos.';
    }

    setFieldErrors(errors);
    return { valid: Object.keys(errors).length === 0, sanitizedMac: sanitized };
  };

  /** Submits create/edit corral payloads and maps 409 or invalidParams errors to fields. */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);

    const { valid, sanitizedMac } = validateClientSide();
    if (!valid) return;

    setIsSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        macAddress: sanitizedMac,
        cleanTime: cleanTime.trim()
          ? cleanTime.includes(':') && cleanTime.length === 5
            ? `${cleanTime}:00`
            : cleanTime
          : null,
        limitOdor: Number(limitOdor),
        pumpDurationSeconds: Number(pumpDurationSeconds),
      };

      if (isEdit && corralToEdit) {
        const updated = await corralService.updateCorral(corralToEdit.id, payload, farmId);
        updateCorralInContext(updated);
      } else {
        const created = await corralService.createCorral(farmId, payload);
        addCorral(created);
      }

      setName('');
      setMacAddress('');
      onSuccess?.();
      onClose();
    } catch (err: any) {
      if (err instanceof ApiError) {
        if (err.invalidParams && Object.keys(err.invalidParams).length > 0) {
          setFieldErrors(err.invalidParams);
        } else if (err.status === 409) {
          setGeneralError(err.detail || 'MAC Address já cadastrado em outro curral.');
        } else {
          setGeneralError(err.detail || err.title || (isEdit ? 'Falha ao atualizar curral.' : 'Falha ao cadastrar curral.'));
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
      aria-labelledby="corral-modal-title"
      data-testid="modal-corral"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/40 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-card-border bg-card p-6 shadow-xl text-foreground max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          data-testid="button-corral-close"
          aria-label="Fechar"
          className="absolute right-4 top-4 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition"
        >
          <X className="size-5" />
        </button>

        <div className="flex items-center gap-2 text-primary">
          <Fence className="size-6" />
          <h2 id="corral-modal-title" className="text-xl font-extrabold tracking-tight">
            {isEdit ? 'Editar Curral' : 'Novo Curral'}
          </h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {isEdit
            ? 'Atualize as configurações e o identificador do hardware ESP32 do curral.'
            : 'Vincule um novo curral à sua fazenda com o MAC Address do dispositivo ESP32.'}
        </p>

        {generalError && (
          <div
            role="alert"
            data-testid="alert-corral-error"
            className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive font-medium flex items-start gap-2"
          >
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <span>{generalError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          <div>
            <label
              htmlFor="corral-name"
              className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1"
            >
              Nome do Curral *
            </label>
            <input
              id="corral-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (fieldErrors.name) {
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.name;
                    return next;
                  });
                }
              }}
              data-testid="input-corral-name"
              placeholder="Ex: Curral de Engorda Norte"
              disabled={isSubmitting}
              className={`w-full rounded-xl border-2 bg-background px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring ${
                fieldErrors.name ? 'border-destructive text-destructive' : 'border-input text-foreground'
              }`}
            />
            {fieldErrors.name && (
              <p
                data-testid="error-corral-name"
                className="mt-1 text-xs font-semibold text-destructive flex items-center gap-1"
              >
                <AlertCircle className="size-3.5 shrink-0" />
                {fieldErrors.name}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="corral-mac"
              className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1"
            >
              MAC Address do ESP32 (12 hex chars) *
            </label>
            <input
              id="corral-mac"
              type="text"
              value={macAddress}
              onChange={(e) => {
                setMacAddress(e.target.value);
                if (fieldErrors.macAddress) {
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.macAddress;
                    return next;
                  });
                }
              }}
              data-testid="input-corral-mac"
              placeholder="Ex: 24:0A:C4:00:01:10 ou 240AC4000110"
              disabled={isSubmitting}
              className={`w-full rounded-xl border-2 bg-background px-3 py-2 text-sm font-mono focus-visible:outline-2 focus-visible:outline-ring uppercase ${
                fieldErrors.macAddress ? 'border-destructive text-destructive' : 'border-input text-foreground'
              }`}
            />
            {fieldErrors.macAddress && (
              <p
                data-testid="error-corral-mac"
                className="mt-1 text-xs font-semibold text-destructive flex items-center gap-1"
              >
                <AlertCircle className="size-3.5 shrink-0" />
                {fieldErrors.macAddress}
              </p>
            )}
            <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Formato: 12 hexadecimais</span>
              <button
                type="button"
                onClick={() => setMacAddress('240AC4000110')}
                className="text-primary hover:underline font-semibold text-[11px]"
              >
                Preencher Wokwi (240AC4000110)
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="corral-time"
              className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1"
            >
              Horário Diário de Limpeza
            </label>
            <input
              id="corral-time"
              type="time"
              value={cleanTime}
              onChange={(e) => setCleanTime(e.target.value)}
              data-testid="input-corral-time"
              disabled={isSubmitting}
              className="w-full rounded-xl border-2 border-input bg-background px-3 py-2 text-sm font-mono focus-visible:outline-2 focus-visible:outline-ring"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="corral-odor"
                className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1"
              >
                Limiar Odor (MQ)
              </label>
              <input
                id="corral-odor"
                type="number"
                min="0"
                value={limitOdor}
                onChange={(e) => setLimitOdor(e.target.value)}
                data-testid="input-corral-odor"
                disabled={isSubmitting}
                className="w-full rounded-xl border-2 border-input bg-background px-3 py-2 text-sm font-mono focus-visible:outline-2 focus-visible:outline-ring"
              />
            </div>
            <div>
              <label
                htmlFor="corral-duration"
                className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1"
              >
                Duração Bomba (s)
              </label>
              <input
                id="corral-duration"
                type="number"
                min="1"
                max="60"
                value={pumpDurationSeconds}
                onChange={(e) => setPumpDurationSeconds(e.target.value)}
                data-testid="input-corral-duration"
                disabled={isSubmitting}
                className="w-full rounded-xl border-2 border-input bg-background px-3 py-2 text-sm font-mono focus-visible:outline-2 focus-visible:outline-ring"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              data-testid="button-corral-cancel"
              disabled={isSubmitting}
              className="rounded-xl border border-input bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              data-testid="button-corral-submit"
              className="rounded-xl bg-primary text-primary-foreground font-bold px-4 py-2 text-xs transition hover:brightness-110 disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
              <span>{isEdit ? 'Salvar Alterações' : 'Cadastrar Curral'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

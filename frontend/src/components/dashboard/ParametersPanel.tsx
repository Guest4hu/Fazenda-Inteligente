import React, { useState, useEffect } from 'react';
import { Clock, Check, AlertCircle } from 'lucide-react';
import { corralService } from '../../services/corralService';
import { ApiError } from '../../services/apiClient';
import type { CorralResponseDTO, CorralParametersRequestDTO } from '../../types/api';

export type Mode = 'manual' | 'automatico';

export interface ParametersPanelProps {
  corralId?: number | null;
  farmId?: number | null;
  corral?: CorralResponseDTO | null;
  mode?: Mode;
  onChangeMode?: (m: Mode) => void;
  timeInput?: string;
  setTimeInput?: (val: string) => void;
  savedTime?: string;
  saved?: boolean;
  onSaveTime?: () => void;
  onParametersUpdated?: (updated: CorralResponseDTO) => void;
  onLogEvent?: (msg: string, kind: 'info' | 'ok' | 'warn' | 'danger') => void;
  onRefresh?: () => void;
  isSimulated?: boolean;
  isLive?: boolean;
}

/**
 * Corral automation and odor-threshold configuration panel supporting manual
 * vs. automatic schedule mode, {@code HH:MM} validation, 1-60s pump duration
 * bounds, and live {@code PUT /parametros} persistence with simulated fallback.
 */
export const ParametersPanel: React.FC<ParametersPanelProps> = ({
  corralId,
  corral,
  mode: propMode,
  onChangeMode,
  timeInput: propTimeInput,
  setTimeInput: propSetTimeInput,
  savedTime: propSavedTime,
  saved: propSaved,
  onSaveTime,
  onParametersUpdated,
  onLogEvent,
  onRefresh,
  isSimulated = false,
  isLive = false,
}) => {
  const [internalMode, setInternalMode] = useState<Mode>(
    corral?.cleanTime ? 'automatico' : 'manual'
  );
  const [internalTimeInput, setInternalTimeInput] = useState<string>(
    corral?.cleanTime ? corral.cleanTime.substring(0, 5) : '06:30'
  );
  const [internalSavedTime, setInternalSavedTime] = useState<string>(
    corral?.cleanTime ? corral.cleanTime.substring(0, 5) : '06:30'
  );
  const [limitOdor, setLimitOdor] = useState<number>(corral?.limitOdor ?? 400);
  const [pumpDuration, setPumpDuration] = useState<number>(corral?.pumpDurationSeconds ?? 30);
  const [internalSaved, setInternalSaved] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  const mode = propMode !== undefined ? propMode : internalMode;
  const timeInput = propTimeInput !== undefined ? propTimeInput : internalTimeInput;
  const savedTime = propSavedTime !== undefined ? propSavedTime : internalSavedTime;
  const saved = propSaved !== undefined ? propSaved : internalSaved;

  const setTimeInput = (val: string) => {
    if (propSetTimeInput) propSetTimeInput(val);
    setInternalTimeInput(val);
  };

  useEffect(() => {
    if (corral) {
      const hasTime = !!corral.cleanTime;
      const computedMode = hasTime ? 'automatico' : 'manual';
      setInternalMode(computedMode);
      if (onChangeMode) onChangeMode(computedMode);
      if (corral.cleanTime) {
        const hhmm = corral.cleanTime.substring(0, 5);
        setInternalTimeInput(hhmm);
        setInternalSavedTime(hhmm);
        if (propSetTimeInput) propSetTimeInput(hhmm);
      }
      setLimitOdor(corral.limitOdor ?? 400);
      setPumpDuration(corral.pumpDurationSeconds ?? 30);
    }
  }, [corral]);

  const handleModeChange = (newMode: Mode) => {
    if (onChangeMode) {
      onChangeMode(newMode);
    } else {
      setInternalMode(newMode);
    }
    if (onLogEvent) {
      onLogEvent(newMode === 'automatico' ? 'Modo automático ativado.' : 'Modo manual ativado.', 'info');
    }
  };

  /**
   * Validates {@code HH:MM} schedule formatting and persists corral parameters,
   * omitting {@code cleanTime} as {@code null} when switching to manual mode.
   */
  const handleSave = async () => {
    setFieldErrors({});
    setGeneralError(null);

    // Validate HH:MM schedule format
    if (mode === 'automatico' && !/^\d{2}:\d{2}$/.test(timeInput)) {
      setFieldErrors({ cleanTime: 'Horário inválido. Use o formato HH:MM.' });
      if (onLogEvent) onLogEvent('Horário inválido. Use o formato HH:MM.', 'danger');
      return;
    }

    if (pumpDuration < 1 || pumpDuration > 60) {
      setFieldErrors({ pumpDurationSeconds: 'A duração da bomba deve estar entre 1 e 60 segundos.' });
      return;
    }

    // Simulated / fallback mode
    if (!isLive || isSimulated || !corralId) {
      if (onSaveTime) {
        onSaveTime();
      } else {
        setInternalSavedTime(timeInput);
        setInternalSaved(true);
        if (onLogEvent) onLogEvent(`Horário diário salvo: ${timeInput} (simulado).`, 'ok');
        window.setTimeout(() => setInternalSaved(false), 2500);
      }
      return;
    }

    // Connected online mode: PUT /currais/{corralId}/parametros
    setIsSubmitting(true);
    try {
      const payload: CorralParametersRequestDTO = {
        cleanTime: mode === 'automatico' ? `${timeInput}:00` : null,
        limitOdor: Number(limitOdor),
        pumpDurationSeconds: Number(pumpDuration),
      };

      const updatedCorral = await corralService.updateParameters(corralId, payload);
      setInternalSavedTime(timeInput);
      setInternalSaved(true);
      if (onParametersUpdated) onParametersUpdated(updatedCorral);
      if (onLogEvent) onLogEvent('Parâmetros operacionais do curral atualizados com sucesso.', 'ok');
      if (onRefresh) onRefresh();
      window.setTimeout(() => setInternalSaved(false), 3000);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.invalidParams) {
          setFieldErrors(err.invalidParams);
        } else {
          setGeneralError(err.detail || err.message);
        }
        if (onLogEvent) onLogEvent(`Falha ao salvar parâmetros: ${err.detail || err.message}`, 'danger');
      } else {
        setGeneralError('Erro de comunicação ao salvar parâmetros.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isOnline = isLive && !isSimulated;

  return (
    <section aria-labelledby="h-modo" className="rounded-2xl border border-card-border bg-card p-5 shadow-sm md:col-span-3 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 id="h-modo" className="text-lg font-bold flex items-center gap-2">
          <Clock className="size-5" aria-hidden /> Modo e horário
        </h2>
        <span
          data-tone={isOnline ? 'online' : 'sim'}
          className="font-mono text-[10px] uppercase tracking-wider rounded-full px-2 py-0.5 bg-accent/40 text-foreground border border-accent"
        >
          {isOnline ? 'Parâmetros ESP32' : 'Simulado'}
        </span>
      </div>

      {/* Operational mode selector (manual vs. scheduled automatic) */}
      <div>
        <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
          Modo de Operação
        </label>
        <div role="radiogroup" aria-label="Modo de operação" className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-muted">
          <button
            type="button"
            role="radio"
            aria-checked={mode === 'manual'}
            onClick={() => handleModeChange('manual')}
            data-testid="mode-manual"
            className={`rounded-lg py-2 font-semibold transition focus-visible:outline-2 focus-visible:outline-ring ${
              mode === 'manual' ? 'bg-primary text-primary-foreground shadow' : 'hover:bg-card'
            }`}
          >
            Manual
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={mode === 'automatico'}
            onClick={() => handleModeChange('automatico')}
            data-testid="mode-automatico"
            className={`rounded-lg py-2 font-semibold transition focus-visible:outline-2 focus-visible:outline-ring ${
              mode === 'automatico' ? 'bg-primary text-primary-foreground shadow' : 'hover:bg-card'
            }`}
          >
            Automático
          </button>
        </div>
      </div>

      <div>
        <label htmlFor="hora" className="block text-sm font-semibold">
          Horário diário de limpeza {mode === 'manual' && <span className="text-xs text-muted-foreground font-normal">(desativado no modo manual)</span>}
        </label>
        <div className="mt-1 flex gap-2">
          <input
            id="hora"
            type="time"
            value={timeInput}
            onChange={(e) => setTimeInput(e.target.value)}
            disabled={mode === 'manual' || isSubmitting}
            data-testid="input-time"
            className="flex-1 rounded-xl border-2 border-input bg-background px-3 py-2.5 font-mono focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={isSubmitting}
            data-testid="button-salvar-horario"
            className="rounded-xl bg-accent text-accent-foreground font-bold px-5 transition active:scale-95 hover:brightness-95 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
          >
            {isSubmitting ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
        {fieldErrors.cleanTime && (
          <p className="text-xs font-semibold text-destructive mt-1 flex items-center gap-1">
            <AlertCircle className="size-3.5" aria-hidden /> {fieldErrors.cleanTime}
          </p>
        )}
      </div>

      <p role="status" className="h-5 text-sm font-semibold text-primary flex items-center gap-1">
        {saved && (
          <span className="pop flex items-center gap-1">
            <Check className="size-4" aria-hidden /> Horário salvo: {savedTime}
          </span>
        )}
      </p>

      {/* Operational thresholds: MQ-135 gas limit and pump cycle duration */}
      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/60">
        <div>
          <label htmlFor="limitOdor" className="block text-xs font-semibold text-muted-foreground">
            Limiar de Odor (MQ-135)
          </label>
          <input
            id="limitOdor"
            type="number"
            min={0}
            step={10}
            value={limitOdor}
            onChange={(e) => setLimitOdor(Number(e.target.value))}
            disabled={isSubmitting}
            className="mt-1 w-full rounded-xl border-2 border-input bg-background px-3 py-2 font-mono text-sm focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
          />
          {fieldErrors.limitOdor && (
            <p className="text-[11px] font-semibold text-destructive mt-0.5">{fieldErrors.limitOdor}</p>
          )}
        </div>
        <div>
          <label htmlFor="pumpDuration" className="block text-xs font-semibold text-muted-foreground">
            Duração da Bomba (s)
          </label>
          <input
            id="pumpDuration"
            type="number"
            min={1}
            max={60}
            value={pumpDuration}
            onChange={(e) => setPumpDuration(Number(e.target.value))}
            disabled={isSubmitting}
            className="mt-1 w-full rounded-xl border-2 border-input bg-background px-3 py-2 font-mono text-sm focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
          />
          {fieldErrors.pumpDurationSeconds && (
            <p className="text-[11px] font-semibold text-destructive mt-0.5">{fieldErrors.pumpDurationSeconds}</p>
          )}
        </div>
      </div>

      {generalError && (
        <div className="rounded-xl bg-destructive/15 border border-destructive/30 p-2.5 text-xs text-destructive font-semibold flex items-center gap-2">
          <AlertCircle className="size-4 shrink-0" aria-hidden />
          <span>{generalError}</span>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {isOnline
          ? 'Os parâmetros operacionais são sincronizados diretamente com o microcontrolador ESP32 do curral via MQTT.'
          : 'O agendamento é simulado e só funciona no modo automático, com esta página aberta. Roda uma vez por dia e horário e nunca ignora a segurança de presença.'}
      </p>
    </section>
  );
};

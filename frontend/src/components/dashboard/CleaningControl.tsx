import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Droplets, OctagonX, ShieldAlert, History, X, Timer } from 'lucide-react';
import { cleanService } from '../../services/cleanService';
import { ApiError } from '../../services/apiClient';
import type { CleanCmdResponseDTO, DeviceStatus } from '../../types/api';

export interface CleaningControlProps {
  corralId?: number | null;
  corralName?: string | null;
  pumpDurationSeconds?: number;
  hasAnimalInCorral?: boolean;
  hasPresence?: boolean; // alias
  deviceStatus?: DeviceStatus | null;
  onLogEvent?: (msg: string, kind: 'info' | 'ok' | 'warn' | 'danger') => void;
  onCleaningComplete?: () => void;
  onRefresh?: () => void;
  isSimulated?: boolean;
  isLive?: boolean;
  washingSimulated?: boolean;
  remainingSimulated?: number;
  onStartWashSimulated?: (durationSeconds?: number) => void;
  onStopWashSimulated?: () => void;
  cleanHistory?: CleanCmdResponseDTO[];
}

/**
 * Manual pump-wash control panel enforcing biological presence locks, 1-60s
 * duration bounds, live {@code POST /limpeza} ACK synchronization, fail-fast
 * 409 conflict surfacing, and automatic emergency shutoff if an animal enters
 * mid-wash. Falls back to a local countdown timer in simulated mode.
 */
export const CleaningControl: React.FC<CleaningControlProps> = ({
  corralId,
  pumpDurationSeconds = 20,
  hasAnimalInCorral: propHasAnimal,
  hasPresence: propHasPresence,
  onLogEvent,
  onCleaningComplete,
  onRefresh,
  isSimulated = false,
  isLive = false,
  washingSimulated,
  remainingSimulated,
  onStartWashSimulated,
  onStopWashSimulated,
  cleanHistory: propCleanHistory,
}) => {
  const hasAnimal = propHasAnimal !== undefined ? propHasAnimal : (propHasPresence ?? false);

  const [internalWashing, setInternalWashing] = useState<boolean>(false);
  const [internalRemaining, setInternalRemaining] = useState<number>(0);
  const [activeDuration, setActiveDuration] = useState<number>(pumpDurationSeconds);
  const [durationInput, setDurationInput] = useState<number | string>(pumpDurationSeconds);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [historyList, setHistoryList] = useState<CleanCmdResponseDTO[]>(propCleanHistory || []);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);

  useEffect(() => {
    setDurationInput(pumpDurationSeconds);
  }, [pumpDurationSeconds]);

  const timerRef = useRef<number | null>(null);
  const washingRef = useRef<boolean>(false);

  const isOnline = isLive && !isSimulated && Boolean(corralId);

  const washing = (!isOnline && washingSimulated !== undefined) ? washingSimulated : internalWashing;
  const remaining = (!isOnline && remainingSimulated !== undefined) ? remainingSimulated : internalRemaining;

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const endWash = useCallback((msg: string, kind: 'info' | 'ok' | 'warn' | 'danger') => {
    clearTimer();
    washingRef.current = false;
    setInternalWashing(false);
    setInternalRemaining(0);
    if (onLogEvent) onLogEvent(msg, kind);
    if (onCleaningComplete) onCleaningComplete();
    if (onRefresh) onRefresh();
  }, [onLogEvent, onCleaningComplete, onRefresh]);

  // Trigger immediate safety stop if animal presence is detected mid-wash
  useEffect(() => {
    if (hasAnimal && washingRef.current) {
      if (isOnline && corralId) {
        cleanService.stopCleaning(corralId).catch(() => {});
      }
      endWash('PARADA DE SEGURANÇA: animal detectado no curral durante a lavagem! Bomba desligada.', 'danger');
    }
  }, [hasAnimal, endWash, isOnline, corralId]);

  useEffect(() => {
    return () => clearTimer();
  }, []);

  useEffect(() => {
    if (propCleanHistory) {
      setHistoryList(propCleanHistory);
    }
  }, [propCleanHistory]);

  const startCountdown = (duration: number) => {
    clearTimer();
    setActiveDuration(duration);
    setInternalRemaining(duration);
    washingRef.current = true;
    setInternalWashing(true);

    let left = duration;
    timerRef.current = window.setInterval(() => {
      left -= 1;
      setInternalRemaining(left);
      if (left <= 0) {
        endWash(
          !isOnline
            ? 'Lavagem simulada concluída. Bomba simulada desligada.'
            : 'Ciclo de lavagem finalizado com sucesso.',
          'ok'
        );
      }
    }, 1000);
  };

  /**
   * Validates the client-side biological lock and 1-60s duration bounds, then
   * either runs a simulated wash countdown or dispatches {@code POST /limpeza}
   * while checking for {@code CANCELADO} MQTT timeouts and 409 fail-fast locks.
   */
  const handleStartWash = async () => {
    setConflictError(null);

    // Client-side pre-check (biological safety lock)
    if (hasAnimal) {
      const msg = 'Lavagem RECUSADA: animal detectado no curral. Bomba simulada continua desligada.';
      setConflictError('Tem uma vaca no curral neste momento, não tem como acionar a bomba de limpeza');
      if (onLogEvent) onLogEvent(msg, 'danger');
      return;
    }

    if (washingRef.current || washing) {
      if (onLogEvent) onLogEvent('Comando ignorado: a bomba já está em andamento.', 'warn');
      return;
    }

    // Validate user-entered wash duration (1-60s)
    const parsed = typeof durationInput === 'string' ? parseInt(durationInput, 10) : durationInput;
    let durationToUse = parsed;

    if (durationInput === '' || isNaN(durationToUse)) {
      durationToUse = pumpDurationSeconds || 30;
    } else if (durationToUse < 1 || durationToUse > 60) {
      const errorMsg = 'A duração da lavagem deve ser entre 1 e 60 segundos.';
      setConflictError(errorMsg);
      if (onLogEvent) onLogEvent(`Lavagem recusada: ${errorMsg}`, 'danger');
      return;
    }

    // Simulated / fallback mode
    if (!isOnline || !corralId) {
      if (onStartWashSimulated) {
        onStartWashSimulated(durationToUse);
      } else {
        if (onLogEvent) onLogEvent('Lavagem simulada iniciada (manual). Bomba simulada LIGADA.', 'ok');
        startCountdown(durationToUse);
      }
      return;
    }

    // Live hardware mode: POST /api/v1/currais/{corralId}/limpeza
    try {
      const response = await cleanService.triggerCleaning(corralId, {
        origin: 'MANUAL',
        secondsDuration: durationToUse,
      });

      // Check whether the command was canceled due to an MQTT ACK timeout
      if (response.state === 'CANCELADO') {
        const warnMsg = response.mensagem || 'Dispositivo não respondeu a tempo ou reportou falha';
        setConflictError(`Comando CANCELADO: ${warnMsg}`);
        if (onLogEvent) onLogEvent(`Falha na lavagem: ${warnMsg}`, 'danger');
        return;
      }

      const duration = response.secondsDuration || durationToUse;
      if (onLogEvent) {
        onLogEvent(`Bomba acionada e confirmada via MQTT (${duration}s).`, 'ok');
      }
      startCountdown(duration);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        // Surface backend 409 Conflict fail-fast lock details
        const detail = err.detail || err.title || 'Falha ao acionar bomba.';
        setConflictError(detail);
        if (onLogEvent) onLogEvent(`Lavagem recusada: ${detail}`, 'danger');
      } else {
        setConflictError('Falha de conexão com o servidor ao acionar a bomba.');
        if (onLogEvent) onLogEvent('Erro de conexão ao acionar a bomba de limpeza.', 'danger');
      }
    }
  };

  /**
   * Applies fail-safe optimistic UI shutoff first so the operator sees an
   * immediate stop, then dispatches the physical pump stop command via backend.
   */
  const handleStopWash = async () => {
    if (!isOnline && onStopWashSimulated) {
      onStopWashSimulated();
      return;
    }

    if (!isOnline || !corralId) {
      if (!washingRef.current && !washing) {
        if (onLogEvent) onLogEvent('Parar acionado: a bomba já estava desligada.', 'info');
        return;
      }
      endWash('Parar acionado pelo usuário. Bomba simulada DESLIGADA.', 'warn');
      return;
    }

    // Live mode: end UI state immediately for instant operator feedback
    endWash('Parar acionado pelo operador. Bomba DESLIGADA.', 'warn');

    // Dispatch physical pump-stop command to the ESP32 via backend
    try {
      if (onLogEvent) onLogEvent('Enviando comando de parada para a bomba...', 'info');
      await cleanService.stopCleaning(corralId);
      fetchHistory();
      if (onRefresh) onRefresh();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        const detail = err.detail || err.title || 'Falha ao parar a bomba.';
        setConflictError(detail);
        if (onLogEvent) onLogEvent(`Falha ao parar bomba: ${detail}`, 'danger');
      } else {
        setConflictError('Erro de conexão ao enviar comando de parada.');
        if (onLogEvent) onLogEvent('Erro de conexão ao parar a bomba.', 'danger');
      }
    }
  };

  const fetchHistory = async () => {
    if (!corralId || !isOnline) return;
    setIsLoadingHistory(true);
    try {
      const data = await cleanService.listCleanHistory(corralId);
      setHistoryList(data);
    } catch {
      // History fetch failure is non-blocking; leave existing list intact
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const toggleHistory = () => {
    const next = !showHistory;
    setShowHistory(next);
    if (next) fetchHistory();
  };

  // Canonical pump status text expected by UI tests
  const pumpStatusText = washing
    ? isOnline ? 'Ligada' : 'Ligada (simulada)'
    : isOnline ? 'Desligada' : 'Desligada (simulada)';

  return (
    <section aria-labelledby="h-bomba" className="rounded-2xl border border-card-border bg-card p-5 shadow-sm md:col-span-4 relative overflow-hidden space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 id="h-bomba" className="text-lg font-bold flex items-center gap-2">
          <Droplets className="size-5" aria-hidden /> Bomba de água
        </h2>
        <span
          data-tone={isOnline ? 'online' : 'sim'}
          className="font-mono text-[10px] uppercase tracking-wider rounded-full px-2 py-0.5 bg-accent/40 text-foreground border border-accent"
        >
          {isOnline ? 'Hardware ESP32' : 'Simulado'}
        </span>
      </div>

      {/* Business rule conflict alert (RFC 7807 409 Conflict) */}
      {conflictError && (
        <div
          role="alert"
          className="rounded-xl bg-destructive/15 border-2 border-destructive text-destructive p-3.5 flex items-start justify-between gap-3 animate-in fade-in"
        >
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="size-5 shrink-0 mt-0.5" aria-hidden />
            <div>
              <p className="font-bold text-sm">Ação Bloqueada por Segurança</p>
              <p className="text-xs mt-0.5 font-medium">{conflictError}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setConflictError(null)}
            className="p-1 hover:bg-destructive/20 rounded-md transition"
            aria-label="Fechar alerta"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      <div className="flex items-center gap-4">
        <div className="relative size-20 shrink-0 rounded-full grid place-items-center bg-muted overflow-hidden" aria-hidden>
          {washing && <span className="ring absolute inset-2 rounded-full bg-primary/30" />}
          <Droplets className={`size-9 relative ${washing ? 'text-primary' : 'text-muted-foreground'}`} />
          {washing && [0, 1, 2].map((i) => (
            <span
              key={i}
              className="drip absolute top-2 size-1.5 rounded-full bg-primary"
              style={{ left: 26 + i * 14, animationDelay: `${i * 0.3}s` }}
            />
          ))}
        </div>

        <div aria-live="polite">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-3xl font-extrabold" data-testid="status-pump">
              {pumpStatusText}
            </p>
            {hasAnimal && (
              <span
                data-testid="badge-biological-lock"
                className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-destructive/15 text-destructive border border-destructive/30 flex items-center gap-1 animate-pulse"
                title="Trava biológica de segurança ativa: animal detectado no curral"
              >
                <ShieldAlert className="size-3" /> Trava Biológica Ativa
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground font-mono">
            {washing
              ? `Restam ${remaining}s de lavagem${!isOnline ? ' simulada' : ''}`
              : 'Aguardando comando'}
          </p>
        </div>
      </div>

      {washing && (
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary origin-left transition-transform duration-1000 ease-linear"
            style={{ transform: `scaleX(${activeDuration > 0 ? remaining / activeDuration : 0})` }}
          />
        </div>
      )}

      {/* Wash duration selector and quick presets */}
      <div className="rounded-xl bg-muted/40 border border-border/60 p-3 space-y-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <label
            htmlFor="input-wash-duration"
            className="text-xs font-semibold text-foreground flex items-center gap-1.5"
          >
            <Timer className="size-4 text-primary" aria-hidden />
            Duração da lavagem:
          </label>
          <div className="flex items-center gap-1.5">
            <input
              id="input-wash-duration"
              data-testid="input-wash-duration"
              type="number"
              min={1}
              max={60}
              disabled={washing}
              value={durationInput}
              onChange={(e) => {
                const val = e.target.value;
                setDurationInput(val === '' ? '' : Number(val));
              }}
              className="w-20 rounded-lg border border-border bg-background px-2.5 py-1 text-sm font-mono text-center font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
              placeholder={String(pumpDurationSeconds || 30)}
            />
            <span className="text-xs font-mono text-muted-foreground">seg</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mr-0.5">
            Atalhos:
          </span>
          {[10, 15, 20, 30, 45, 60].map((sec) => (
            <button
              key={sec}
              type="button"
              disabled={washing}
              data-testid={`btn-duration-${sec}`}
              onClick={() => setDurationInput(sec)}
              className={`px-2.5 py-1 rounded-md text-xs font-mono transition ${
                Number(durationInput) === sec
                  ? 'bg-primary text-primary-foreground font-bold shadow-sm'
                  : 'bg-card hover:bg-muted text-muted-foreground hover:text-foreground border border-border/80'
              } disabled:opacity-50`}
            >
              {sec}s
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          data-testid="button-lavar"
          onClick={handleStartWash}
          disabled={washing}
          className="flex-1 min-w-36 rounded-xl bg-primary text-primary-foreground font-bold py-3.5 px-5 transition active:scale-95 hover:brightness-110 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Lavar agora
        </button>
        <button
          type="button"
          data-testid="button-parar"
          onClick={handleStopWash}
          className="flex-1 min-w-36 rounded-xl bg-destructive text-destructive-foreground font-bold py-3.5 px-5 transition active:scale-95 hover:brightness-110 flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-destructive"
        >
          <OctagonX className="size-5" aria-hidden /> Parar
        </button>
      </div>

      {/* Fail-fast safety lock indicators */}
      <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground flex-wrap gap-2">
        <span className="font-semibold flex items-center gap-1">
          <ShieldAlert className="size-3.5 text-primary shrink-0" aria-hidden />
          Travas de Segurança:
        </span>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="px-1.5 py-0.5 rounded-md bg-muted font-mono text-[10px]" title="Impede lavagem se houver animais no curral">
            Biológica
          </span>
          <span className="px-1.5 py-0.5 rounded-md bg-muted font-mono text-[10px]" title="Impede acionamentos simultâneos ou conflitantes">
            Concorrência
          </span>
          <span className="px-1.5 py-0.5 rounded-md bg-muted font-mono text-[10px]" title="Exige sinal recente do ESP32 (<60s)">
            Conectividade
          </span>
        </div>
      </div>

      {/* Wash command history toggle and table */}
      {isOnline && corralId && (
        <div className="pt-2">
          <button
            type="button"
            onClick={toggleHistory}
            className="text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition"
          >
            <History className="size-3.5" />
            {showHistory ? 'Ocultar Histórico de Limpezas' : 'Ver Histórico de Limpezas'}
          </button>

          {showHistory && (
            <div className="mt-3 rounded-xl border border-border bg-card p-3 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-muted-foreground pb-2 border-b border-border">
                <span>Histórico de Acionamentos</span>
                <button
                  type="button"
                  onClick={fetchHistory}
                  disabled={isLoadingHistory}
                  className="text-primary hover:underline"
                >
                  {isLoadingHistory ? 'Atualizando...' : 'Atualizar'}
                </button>
              </div>

              {historyList.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3">Nenhum acionamento registrado.</p>
              ) : (
                <div className="max-h-48 overflow-y-auto divide-y divide-border text-xs">
                  {historyList.map((item) => (
                    <div key={item.id} className="py-2 flex items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            item.state === 'CONCLUIDO'
                              ? 'bg-primary/20 text-primary'
                              : item.state === 'CANCELADO'
                              ? 'bg-destructive/20 text-destructive'
                              : 'bg-muted text-muted-foreground'
                          }`}>
                            {item.state}
                          </span>
                          <span className="font-semibold text-foreground">{item.origin}</span>
                          <span className="text-muted-foreground font-mono text-[11px]">{item.secondsDuration}s</span>
                        </div>
                        {item.mensagem && <p className="text-[11px] text-muted-foreground mt-0.5">{item.mensagem}</p>}
                      </div>
                      <time className="font-mono text-[11px] text-muted-foreground shrink-0">
                        {new Date(item.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </time>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
};

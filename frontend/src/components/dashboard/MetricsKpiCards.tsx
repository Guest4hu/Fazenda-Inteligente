import React from 'react';
import { Thermometer, Droplets, Wind, Sparkles, AlertTriangle, RefreshCw } from 'lucide-react';
import type { CorralMetricsResponseDTO } from '../../types/api';

export interface MetricsKpiCardsProps {
  temp?: number;
  hum?: number;
  mq?: number;
  sensors?: { temp: number; hum: number; mq: number };
  latestOdorValue?: number | null;
  limitOdor?: number;
  metrics?: CorralMetricsResponseDTO | null;
  isSimulated?: boolean;
  isLive?: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  isLoading?: boolean;
}

/**
 * Renders the KPI cards for ambient DHT22 temperature/humidity and MQ-135 raw
 * ADC odor readings, highlighting threshold alerts against {@code limitOdor}
 * and switching cleanly between live telemetry and local simulation metrics.
 */
export const MetricsKpiCards: React.FC<MetricsKpiCardsProps> = ({
  temp,
  hum,
  mq,
  sensors,
  latestOdorValue,
  limitOdor = 400,
  metrics,
  isSimulated = false,
  isLive = false,
  onRefresh,
  isRefreshing = false,
}) => {
  const currentTemp = temp !== undefined ? temp : (sensors?.temp ?? 27.4);
  const currentHum = hum !== undefined ? hum : (sensors?.hum ?? 63.2);
  const currentMq = latestOdorValue !== undefined && latestOdorValue !== null
    ? latestOdorValue
    : (mq !== undefined ? mq : (sensors?.mq ?? 412));

  const isOdorHigh = currentMq >= limitOdor;
  const isOnline = isLive && !isSimulated;

  return (
    <section aria-labelledby="h-sens" className="rounded-2xl border border-card-border bg-card p-5 shadow-sm md:col-span-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 id="h-sens" className="text-lg font-bold">Sensores</h2>
        <span
          data-tone={isOnline ? 'online' : 'sim'}
          className="font-mono text-[10px] uppercase tracking-wider rounded-full px-2 py-0.5 bg-accent/40 text-foreground border border-accent"
        >
          {isOnline ? 'Telemetria ao vivo' : 'Valores simulados'}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        {/* DHT22 Temperatura */}
        <div className="rounded-xl bg-muted p-3">
          <dt className="text-xs flex justify-center gap-1 items-center text-muted-foreground font-medium">
            <Thermometer className="size-3.5 text-primary" aria-hidden />
            DHT22 temp.
          </dt>
          <dd className="font-mono text-xl font-semibold mt-1" data-testid="value-temp">
            {typeof currentTemp === 'number' ? currentTemp.toFixed(1) : currentTemp}°C
          </dd>
        </div>

        {/* DHT22 Umidade */}
        <div className="rounded-xl bg-muted p-3">
          <dt className="text-xs flex justify-center gap-1 items-center text-muted-foreground font-medium">
            <Droplets className="size-3.5 text-primary" aria-hidden />
            DHT22 umid.
          </dt>
          <dd className="font-mono text-xl font-semibold mt-1" data-testid="value-hum">
            {typeof currentHum === 'number' ? currentHum.toFixed(1) : currentHum}%
          </dd>
        </div>

        {/* MQ-135 Odor Bruto */}
        <div className={`rounded-xl p-3 transition-colors ${isOdorHigh ? 'bg-destructive/15 border border-destructive/30' : 'bg-muted'}`}>
          <dt className="text-xs flex justify-center gap-1 items-center text-muted-foreground font-medium">
            <Wind className={`size-3.5 ${isOdorHigh ? 'text-destructive' : 'text-primary'}`} aria-hidden />
            MQ-135 bruto
          </dt>
          <dd className={`font-mono text-xl font-semibold mt-1 ${isOdorHigh ? 'text-destructive font-extrabold' : ''}`} data-testid="value-mq">
            {Math.round(currentMq)}
          </dd>
        </div>
      </dl>

      {/* MQ-135 gas threshold status */}
      <div className="mt-3 flex items-center justify-between text-xs px-1 text-muted-foreground">
        <span>MQ-135: leitura analógica bruta sem calibração.</span>
        {isOdorHigh ? (
          <span className="flex items-center gap-1 font-semibold text-destructive">
            <AlertTriangle className="size-3.5" aria-hidden /> Limiar excedido (&ge; {limitOdor})
          </span>
        ) : (
          <span className="flex items-center gap-1 font-semibold text-primary">
            <Sparkles className="size-3.5" aria-hidden /> Normal (&lt; {limitOdor})
          </span>
        )}
      </div>

      {/* Consolidated corral operational metrics */}
      {metrics && (
        <div className="mt-3 grid grid-cols-3 gap-2 pt-2 border-t border-border/60 text-xs">
          <div className="bg-background/80 rounded-lg p-2 text-center border border-border/40">
            <p className="text-muted-foreground font-medium">Ocupação</p>
            <p className="font-mono font-bold text-sm text-foreground mt-0.5">
              {metrics.totalAnimaisNoCurral} / {metrics.totalAnimaisNaFazenda}
            </p>
          </div>
          <div className="bg-background/80 rounded-lg p-2 text-center border border-border/40">
            <p className="text-muted-foreground font-medium">Limpezas Hoje</p>
            <p className="font-mono font-bold text-sm text-foreground mt-0.5">
              {metrics.limpezasHojeTotal} <span className="text-[10px] font-normal text-muted-foreground">({metrics.limpezasHojeOdor} odor)</span>
            </p>
          </div>
          <div className="bg-background/80 rounded-lg p-2 text-center border border-border/40">
            <p className="text-muted-foreground font-medium">Pendências</p>
            <p className={`font-mono font-bold text-sm mt-0.5 ${metrics.pendenciasAbertas > 0 ? 'text-destructive' : 'text-primary'}`}>
              {metrics.pendenciasAbertas}
            </p>
          </div>
        </div>
      )}

      {onRefresh && (
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          data-testid="button-atualizar"
          className="mt-3 inline-flex items-center gap-2 rounded-xl border-2 border-input px-4 py-2 font-semibold text-sm transition active:scale-95 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
        >
          <RefreshCw className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`} aria-hidden />
          <span>{isOnline ? 'Atualizar leituras' : 'Atualizar leituras simuladas'}</span>
        </button>
      )}
    </section>
  );
};

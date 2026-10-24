import React, { useState } from 'react';
import { Wind } from 'lucide-react';
import type { OdorTelemetryResponseDTO } from '../../types/api';

export interface OdorChartProps {
  readings?: OdorTelemetryResponseDTO[];
  limitOdor?: number;
  isLoading?: boolean;
  className?: string;
  isLive?: boolean;
  simulatedMqValue?: number;
}

export const OdorChart: React.FC<OdorChartProps> = ({
  readings = [],
  limitOdor = 400,
  isLoading = false,
  className = '',
  isLive = false,
  simulatedMqValue = 412,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Se não estiver online e sem leituras reais, cria um mock visual baseado no valor simulado
  const effectiveReadings: OdorTelemetryResponseDTO[] = readings.length > 0
    ? readings
    : isLive
    ? []
    : [
        { id: 1, corralId: 0, value: simulatedMqValue - 30, instant: new Date(Date.now() - 600000).toISOString() },
        { id: 2, corralId: 0, value: simulatedMqValue - 10, instant: new Date(Date.now() - 480000).toISOString() },
        { id: 3, corralId: 0, value: simulatedMqValue + 15, instant: new Date(Date.now() - 360000).toISOString() },
        { id: 4, corralId: 0, value: simulatedMqValue - 5, instant: new Date(Date.now() - 240000).toISOString() },
        { id: 5, corralId: 0, value: simulatedMqValue, instant: new Date().toISOString() },
      ];

  // Ordena leituras em ordem cronológica (esquerda para a direita)
  const sorted = [...effectiveReadings].sort((a, b) => new Date(a.instant).getTime() - new Date(b.instant).getTime());

  if (isLoading) {
    return (
      <section className={`rounded-2xl border border-card-border bg-card p-5 shadow-sm md:col-span-3 ${className}`}>
        <div className="h-48 rounded-xl bg-muted/40 animate-pulse flex items-center justify-center text-sm text-muted-foreground">
          Carregando leituras de odor...
        </div>
      </section>
    );
  }

  if (sorted.length === 0) {
    return (
      <section className={`rounded-2xl border border-card-border bg-card p-5 shadow-sm md:col-span-3 ${className}`}>
        <div className="flex items-center justify-between gap-2 flex-wrap mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Wind className="size-5" aria-hidden /> Histórico de Amônia (MQ-135)
          </h2>
          <span className="font-mono text-[10px] uppercase tracking-wider rounded-full px-2 py-0.5 bg-accent/40 text-foreground border border-accent">
            Sem Dados
          </span>
        </div>
        <div className="h-44 rounded-xl border border-dashed border-border flex flex-col items-center justify-center text-center p-4">
          <p className="text-sm font-semibold text-muted-foreground">Nenhuma leitura de odor registrada ainda</p>
          <p className="text-xs text-muted-foreground/80 mt-1">O sensor MQ-135 reportará leituras a cada batimento MQTT do ESP32.</p>
        </div>
      </section>
    );
  }

  const width = 600;
  const height = 180;
  const padLeft = 45;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 30;

  const values = sorted.map((r) => r.value);
  const minVal = Math.max(0, Math.min(...values, limitOdor) - 40);
  const maxVal = Math.max(...values, limitOdor) + 50;

  const getX = (index: number) => {
    if (sorted.length === 1) return (width - padLeft - padRight) / 2 + padLeft;
    return padLeft + (index / (sorted.length - 1)) * (width - padLeft - padRight);
  };

  const getY = (val: number) => {
    const range = maxVal - minVal || 1;
    return height - padBottom - ((val - minVal) / range) * (height - padTop - padBottom);
  };

  // Coordenadas dos pontos
  const points = sorted.map((r, i) => ({
    x: getX(i),
    y: getY(r.value),
    reading: r,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaPath = points.length > 0
    ? `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(height - padBottom).toFixed(1)} L ${points[0].x.toFixed(1)} ${(height - padBottom).toFixed(1)} Z`
    : '';

  const thresholdY = getY(limitOdor);

  const formatInstant = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return iso;
    }
  };

  const latestVal = values[values.length - 1];
  const isHighNow = latestVal >= limitOdor;

  return (
    <section className={`rounded-2xl border border-card-border bg-card p-5 shadow-sm md:col-span-3 space-y-3 ${className}`}>
      {/* Cabeçalho do Card */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Wind className="size-5" aria-hidden /> Telemetria de Amônia (MQ-135)
        </h2>
        <span
          data-tone={isLive && readings.length > 0 ? 'online' : 'sim'}
          className="font-mono text-[10px] uppercase tracking-wider rounded-full px-2 py-0.5 bg-accent/40 text-foreground border border-accent"
        >
          {isLive && readings.length > 0 ? `${sorted.length} amostras` : 'Tendência Simulada'}
        </span>
      </div>

      {/* Resumo e Limiar */}
      <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Última:</span>
          <span className={`font-mono text-sm font-bold ${isHighNow ? 'text-destructive' : 'text-primary'}`}>
            {latestVal}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-0.5 bg-amber-500 border border-amber-500 border-dashed" />
          <span className="text-muted-foreground font-mono">Limiar de Lavagem: {limitOdor}</span>
        </div>
      </div>

      {/* Canvas SVG Responsivo */}
      <div className="relative w-full overflow-hidden rounded-xl bg-background border border-border p-2">
        <svg
          data-testid="chart-odor-svg"
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-40 sm:h-44 overflow-visible select-none"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="odorGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary, #2d7a46)" stopOpacity="0.25" />
              <stop offset="100%" stopColor="var(--color-primary, #2d7a46)" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Linhas de Grade Horizontal */}
          {[minVal, Math.round((minVal + maxVal) / 2), maxVal].map((gridVal) => {
            const y = getY(gridVal);
            return (
              <g key={gridVal}>
                <line x1={padLeft} y1={y} x2={width - padRight} y2={y} stroke="currentColor" strokeOpacity="0.1" />
                <text x={padLeft - 6} y={y + 3} textAnchor="end" className="text-[10px] font-mono fill-muted-foreground">
                  {gridVal}
                </text>
              </g>
            );
          })}

          {/* Linha Tracejada de Limiar */}
          <line
            x1={padLeft}
            y1={thresholdY}
            x2={width - padRight}
            y2={thresholdY}
            stroke="#f59e0b"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />

          {/* Área e Linha das Leituras */}
          <path d={areaPath} fill="url(#odorGradient)" />
          <path d={linePath} fill="none" stroke="var(--color-primary, #2d7a46)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

          {/* Nós / Pontos de Leitura */}
          {points.map((p, i) => {
            const isCritical = p.reading.value >= limitOdor;
            const isHovered = hoveredIdx === i;
            return (
              <g key={p.reading.id || i}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isHovered ? 5 : 3}
                  className={`transition-all cursor-pointer ${isCritical ? 'fill-destructive stroke-card' : 'fill-primary stroke-card'}`}
                  strokeWidth="1.5"
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                />
              </g>
            );
          })}
        </svg>

        {/* Tooltip ao passar o cursor */}
        {hoveredIdx !== null && points[hoveredIdx] && (
          <div
            className="absolute z-10 -translate-x-1/2 bottom-12 pointer-events-none rounded-lg bg-foreground text-background px-2.5 py-1 text-xs shadow-lg font-mono"
            style={{ left: `${(points[hoveredIdx].x / width) * 100}%` }}
          >
            <div className="font-bold flex items-center gap-1.5">
              <span>{points[hoveredIdx].reading.value}</span>
              {points[hoveredIdx].reading.value >= limitOdor && <span className="text-amber-400 font-sans text-[10px]">(Acima do Limiar)</span>}
            </div>
            <div className="text-[10px] opacity-80">{formatInstant(points[hoveredIdx].reading.instant)}</div>
          </div>
        )}
      </div>
    </section>
  );
};

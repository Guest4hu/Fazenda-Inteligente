import React from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import type { DeviceStatus } from '../../types/api';

export interface ConnectivityBannerProps {
  deviceStatus?: DeviceStatus | null;
  lastSeenAt?: string | null;
  macAddress?: string | null;
  corralName?: string | null;
  isSimulated?: boolean;
  isLive?: boolean;
  isSseConnected?: boolean;
}

/**
 * Displays the ESP32 device connectivity status banner for the selected corral,
 * distinguishing between local simulation fallback, offline heartbeat staleness,
 * and live MQTT/SSE telemetry.
 */
export const ConnectivityBanner: React.FC<ConnectivityBannerProps> = ({
  deviceStatus,
  lastSeenAt,
  macAddress,
  corralName,
  isSimulated = false,
  isLive,
  isSseConnected,
}) => {
  // Treat missing telemetry or disabled live mode as local simulation
  const effectiveSimulated = isSimulated || (isLive !== undefined && !isLive) || !deviceStatus;

  // 1. Preserve simulated mode banner for offline/fallback compatibility
  if (effectiveSimulated) {
    return (
      <div
        role="alert"
        className="bg-destructive text-destructive-foreground text-center text-sm font-semibold px-4 py-2"
        data-testid="banner-esp32"
      >
        Não conectado ao ESP32. Tudo aqui é simulado: nenhuma bomba real é controlada.
      </div>
    );
  }

  const formatLastSeen = (iso?: string | null) => {
    if (!iso) return 'Nenhum sinal recente';
    try {
      const date = new Date(iso);
      if (isNaN(date.getTime())) return iso;
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return iso;
    }
  };

  const formattedTime = formatLastSeen(lastSeenAt);

  if (deviceStatus === 'OFFLINE') {
    return (
      <div
        role="alert"
        className="bg-destructive text-destructive-foreground text-center text-sm font-semibold px-4 py-2 flex items-center justify-center gap-2"
        data-testid="banner-esp32"
      >
        <WifiOff className="size-4 shrink-0" aria-hidden />
        <span>
          ESP32 OFFLINE: O dispositivo {corralName ? `do ${corralName} ` : ''}está sem comunicação recente. (Último contato: {formattedTime}).
        </span>
      </div>
    );
  }

  return (
    <div
      role="status"
      className="bg-primary/15 text-primary text-center text-sm font-semibold px-4 py-2 border-b border-primary/20 flex items-center justify-center gap-2"
      data-testid="banner-esp32"
    >
      <span className="relative flex size-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
        <span className="relative inline-flex rounded-full size-2.5 bg-primary" />
      </span>
      <Wifi className="size-4 shrink-0" aria-hidden />
      <span>
        ESP32 ONLINE: Dispositivo conectado e operacional {macAddress ? `(MAC: ${macAddress})` : ''} — Último batimento: {formattedTime}
      </span>
      {isSseConnected && (
        <span
          data-testid="badge-sse-live"
          className="ml-2 inline-flex items-center gap-1 rounded-full bg-primary/20 px-2 py-0.5 text-xs font-semibold text-primary"
          title="Streaming de telemetria ativo em tempo real (SSE)"
        >
          <span className="size-1.5 rounded-full bg-primary animate-pulse" />
          Tempo Real (SSE)
        </span>
      )}
    </div>
  );
};

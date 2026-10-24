/**
 * src/types/api.ts
 * Contratos de dados canônicos (DTOs) e enums da API REST do Curral Inteligente.
 * Baseado na Seção 11 de api-frontend.md e modelos do backend Spring Boot.
 */

// ============================================================================
// 1. ENUMS E TIPOS LITERAIS
// ============================================================================

export type DeviceStatus = 'ONLINE' | 'OFFLINE';
export const DeviceStatus = {
  ONLINE: 'ONLINE' as const,
  OFFLINE: 'OFFLINE' as const,
};

export type AnimalEventType = 'ENTROU' | 'SAIU';
export const AnimalEventType = {
  ENTROU: 'ENTROU' as const,
  SAIU: 'SAIU' as const,
};

export type EventOrigin = 'TAG' | 'MANUAL';
export const EventOrigin = {
  TAG: 'TAG' as const,
  MANUAL: 'MANUAL' as const,
};

export type CleanOrigin = 'AUTOMATICA' | 'MANUAL' | 'EVENTO';
export const CleanOrigin = {
  AUTOMATICA: 'AUTOMATICA' as const,
  MANUAL: 'MANUAL' as const,
  EVENTO: 'EVENTO' as const,
};

export type CleanState = 'PENDENTE' | 'EM_ANDAMENTO' | 'CONCLUIDO' | 'CANCELADO';
export const CleanState = {
  PENDENTE: 'PENDENTE' as const,
  EM_ANDAMENTO: 'EM_ANDAMENTO' as const,
  CONCLUIDO: 'CONCLUIDO' as const,
  CANCELADO: 'CANCELADO' as const,
};

// ============================================================================
// 2. RFC 7807 PROBLEM DETAIL (TRATAMENTO DE ERROS PADRÃO)
// ============================================================================

export interface InvalidParam {
  name: string;
  reason: string;
}

export interface ProblemDetail {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  invalidParams?: Record<string, string>;
  [key: string]: unknown;
}

// ============================================================================
// 3. MÓDULO 1 — AUTENTICAÇÃO (AUTH)
// ============================================================================

export interface RegisterRequestDTO {
  name: string;
  email: string;
  password: string;
}

export interface LoginRequestDTO {
  email: string;
  password: string;
}

export interface AuthResponseDTO {
  token: string;
  userId: number;
  name: string;
  email: string;
}
export type TokenResponseDTO = AuthResponseDTO;

export interface AuthUser {
  id: number;
  userId?: number;
  name: string;
  email: string;
}

// ============================================================================
// 4. MÓDULO 2 — FAZENDAS (FARMS)
// ============================================================================

export interface FarmRequestDTO {
  name: string;
}

export interface FarmResponseDTO {
  id: number;
  name: string;
  createdAt: string; // ISO-8601 LocalDateTime
}

// ============================================================================
// 5. MÓDULO 3 — CURRAIS, PARÂMETROS E MÉTRICAS
// ============================================================================

export interface CorralRequestDTO {
  name: string;
  macAddress: string; // 12 hex chars (ex: "240AC4000110")
  cleanTime?: string | null; // "HH:mm:ss" ou "HH:mm"
  limitOdor?: number | null; // default 400
  pumpDurationSeconds?: number | null; // 1..60, default 30
}

export interface CorralParametersRequestDTO {
  cleanTime?: string | null; // Envie null para desligar o agendamento
  limitOdor?: number | null;
  pumpDurationSeconds?: number | null;
}
export type CorralParametersDTO = CorralParametersRequestDTO;

export interface CorralResponseDTO {
  id: number;
  farmId: number;
  name: string;
  macAddress: string;
  cleanTime: string | null;
  limitOdor: number;
  pumpDurationSeconds: number;
  deviceStatus: DeviceStatus;
  lastSeenAt: string | null;
}

export interface CorralMetricsResponseDTO {
  corralId: number;
  corralName: string;
  farmId: number;
  farmName: string;
  totalAnimaisNoCurral: number;
  totalAnimaisNaFazenda: number;
  limpezasHojeTotal: number;
  limpezasHojeManual: number;
  limpezasHojeOdor: number;
  limpezasHojeAutomatica: number;
  deviceStatus: DeviceStatus;
  lastSeenAt: string | null;
  pendenciasAbertas: number;
}
export type CorralMetricsDTO = CorralMetricsResponseDTO;

// ============================================================================
// 6. MÓDULO 4 — ANIMAIS E PRESENÇA RFID
// ============================================================================

export interface AnimalRequestDTO {
  name: string;
  identification?: string | null;
  tagUid: string;
}

export interface AnimalResponseDTO {
  id: number;
  farmId: number;
  name: string;
  identification: string | null;
  tagUid: string;
  currentCorralId: number | null;
  currentCorralName: string | null;
}

export interface AnimalPresenceRequestDTO {
  tagUid: string;
  typeEvent: AnimalEventType;
  origin?: EventOrigin;
}
export type PresencaRequestDTO = AnimalPresenceRequestDTO;

export interface AnimalEventResponseDTO {
  id: number;
  corralId: number;
  corralName: string;
  animalId: number;
  animalName: string;
  tagUid: string;
  typeEvent: AnimalEventType;
  eventOrigin: EventOrigin;
  instant: string;
}

// ============================================================================
// 7. MÓDULO 5 — PENDÊNCIAS DE IDENTIFICAÇÃO RFID
// ============================================================================

export interface ResolvePendencyRequestDTO {
  animalId: number;
}
export type ResolverPendenciaRequestDTO = ResolvePendencyRequestDTO;

export interface IdentifyPendencyResponseDTO {
  id: number;
  corralId: number;
  tagUid: string;
  typeEvent: AnimalEventType;
  instant: string;
  resolved: boolean;
  animalIdResolved: number | null;
  animalNameResolved: string | null;
  resolvedAt: string | null;
}
export type PendenciaResponseDTO = IdentifyPendencyResponseDTO;

// ============================================================================
// 8. MÓDULO 6 — LIMPEZA DO CURRAL
// ============================================================================

export interface CleanCmdRequestDTO {
  origin?: CleanOrigin;
  secondsDuration?: number;
}

export interface CleanCmdResponseDTO {
  id: string; // UUID v4
  corralId: number;
  origin: CleanOrigin;
  state: CleanState;
  secondsDuration: number;
  createdAt: string;
  mensagem: string | null;
}

// ============================================================================
// 9. MÓDULO 7 — TELEMETRIA DE ODOR (MQ-135)
// ============================================================================

export interface OdorTelemetryResponseDTO {
  id: number;
  corralId: number;
  value: number;
  instant: string;
}
export type OdorReadingResponseDTO = OdorTelemetryResponseDTO;

// ============================================================================
// 10. MÓDULO 8 — STREAMING EM TEMPO REAL (SERVER-SENT EVENTS - SSE)
// ============================================================================

export type SseEventType = 'connected' | 'limpeza' | 'odor' | 'status' | 'presenca' | 'pendencia';

export interface SseConnectedData {
  corralId: number;
  status: string;
}

export interface SseEventPayloadMap {
  connected: SseConnectedData;
  limpeza: CleanCmdResponseDTO;
  odor: OdorTelemetryResponseDTO;
  status: CorralResponseDTO;
  presenca: AnimalEventResponseDTO;
  pendencia: IdentifyPendencyResponseDTO;
}

export type SseEventHandler<T = unknown> = (data: T) => void;

export interface SseSubscriptionOptions {
  corralId: number;
  farmId?: number | null;
  token?: string | null | (() => string | null);
  onConnected?: (data: SseConnectedData) => void;
  onLimpeza?: (data: CleanCmdResponseDTO) => void;
  onOdor?: (data: OdorTelemetryResponseDTO) => void;
  onStatus?: (data: CorralResponseDTO) => void;
  onPresenca?: (data: AnimalEventResponseDTO) => void;
  onPendencia?: (data: IdentifyPendencyResponseDTO) => void;
  onMessage?: (event: MessageEvent) => void;
  onOpen?: (event: Event) => void;
  onError?: (error: Event) => void;
  onClose?: () => void;
  autoReconnect?: boolean;
  reconnectDelayMs?: number;
  maxReconnectAttempts?: number;
}

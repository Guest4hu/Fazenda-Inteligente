/**
 * Shared Test Helper & HTTP Client for Curral Inteligente E2E Test Suite
 * Authoritative specification: api-frontend.md & backend Spring Boot REST API
 */

export const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8080/api/v1';

export type DeviceStatus = 'ONLINE' | 'OFFLINE';
export type AnimalEventType = 'ENTROU' | 'SAIU';
export type EventOrigin = 'TAG' | 'MANUAL';
export type CleanOrigin = 'AUTOMATICA' | 'MANUAL' | 'EVENTO';
export type CleanState = 'PENDENTE' | 'EM_ANDAMENTO' | 'CONCLUIDO' | 'CANCELADO';

export interface ProblemDetail {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  invalidParams?: Record<string, string>;
}

export interface AuthResponseDTO {
  token: string;
  userId: number;
  name: string;
  email: string;
}

export interface FarmResponseDTO {
  id: number;
  name: string;
  createdAt: string;
}

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

export interface AnimalResponseDTO {
  id: number;
  farmId: number;
  name: string;
  identification: string | null;
  tagUid: string;
  currentCorralId: number | null;
  currentCorralName: string | null;
}

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

export interface CleanCmdResponseDTO {
  id: string;
  corralId: number;
  origin: CleanOrigin;
  state: CleanState;
  secondsDuration: number;
  createdAt: string;
  mensagem: string | null;
}

export interface OdorTelemetryResponseDTO {
  id: number;
  corralId: number;
  value: number;
  instant: string;
}

export interface ApiResponse<T> {
  status: number;
  ok: boolean;
  data: T | null;
  error: ProblemDetail | null;
  headers: Headers;
}

/**
 * Perform an HTTP request against the API
 */
export async function apiRequest<T = any>(
  path: string,
  options: {
    method?: string;
    token?: string;
    body?: any;
    headers?: Record<string, string>;
  } = {}
): Promise<ApiResponse<T>> {
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }

  const fetchOptions: RequestInit = {
    method: options.method || 'GET',
    headers,
  };

  if (options.body !== undefined && options.method !== 'GET') {
    fetchOptions.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
  }

  const response = await fetch(url, fetchOptions);
  let parsedBody: any = null;

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('json') || contentType.includes('problem+json')) {
    try {
      parsedBody = await response.json();
    } catch {
      parsedBody = null;
    }
  } else {
    try {
      const text = await response.text();
      if (text.length > 0) {
        parsedBody = text;
      }
    } catch {
      parsedBody = null;
    }
  }

  return {
    status: response.status,
    ok: response.ok,
    data: response.ok ? parsedBody : null,
    error: !response.ok ? (parsedBody as ProblemDetail) : null,
    headers: response.headers,
  };
}

// ----------------------------------------------------------------------------
// Random Generators & Test Fixtures
// ----------------------------------------------------------------------------

export function uniqueId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

export function randomEmail(): string {
  return `test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}@e2e-fazenda.com`;
}

/**
 * 12-char hex MAC address required by backend: ^[0-9A-Fa-f]{12}$
 */
export function randomMac(): string {
  const hex = '0123456789ABCDEF';
  let mac = '';
  for (let i = 0; i < 12; i++) {
    mac += hex.charAt(Math.floor(Math.random() * hex.length));
  }
  return mac;
}

export function randomTagUid(): string {
  const hex = '0123456789ABCDEF';
  let tag = '';
  for (let i = 0; i < 8; i++) {
    tag += hex.charAt(Math.floor(Math.random() * hex.length));
  }
  return tag;
}

/**
 * Create a new registered user and return auth token
 */
export async function createTestUser(name?: string): Promise<{
  token: string;
  userId: number;
  email: string;
  name: string;
}> {
  const email = randomEmail();
  const userName = name || `Produtor ${uniqueId()}`;
  const password = 'Password@123';

  const res = await apiRequest<AuthResponseDTO>('/auth/register', {
    method: 'POST',
    body: { name: userName, email, password },
  });

  if (!res.ok || !res.data?.token) {
    throw new Error(`Failed to create test user: ${res.status} - ${JSON.stringify(res.error || res.data)}`);
  }

  return {
    token: res.data.token,
    userId: res.data.userId,
    email: res.data.email,
    name: res.data.name,
  };
}

/**
 * Create a test farm
 */
export async function createTestFarm(token: string, name?: string): Promise<FarmResponseDTO> {
  const farmName = name || `Fazenda ${uniqueId()}`;
  const res = await apiRequest<FarmResponseDTO>('/farms', {
    method: 'POST',
    token,
    body: { name: farmName },
  });

  if (!res.ok || !res.data) {
    throw new Error(`Failed to create test farm: ${res.status} - ${JSON.stringify(res.error || res.data)}`);
  }

  return res.data;
}

/**
 * Create a test corral
 */
export async function createTestCorral(
  token: string,
  farmId: number,
  overrides?: {
    name?: string;
    macAddress?: string;
    cleanTime?: string | null;
    limitOdor?: number;
    pumpDurationSeconds?: number;
  }
): Promise<CorralResponseDTO> {
  const corralName = overrides?.name || `Curral ${uniqueId()}`;
  const macAddress = overrides?.macAddress || randomMac();

  const res = await apiRequest<CorralResponseDTO>(`/farms/${farmId}/currais`, {
    method: 'POST',
    token,
    body: {
      name: corralName,
      macAddress,
      cleanTime: overrides?.cleanTime ?? '06:30:00',
      limitOdor: overrides?.limitOdor ?? 400,
      pumpDurationSeconds: overrides?.pumpDurationSeconds ?? 30,
    },
  });

  if (!res.ok || !res.data) {
    throw new Error(`Failed to create test corral: ${res.status} - ${JSON.stringify(res.error || res.data)}`);
  }

  return res.data;
}

/**
 * Create a test animal
 */
export async function createTestAnimal(
  token: string,
  farmId: number,
  overrides?: {
    name?: string;
    identification?: string;
    tagUid?: string;
  }
): Promise<AnimalResponseDTO> {
  const animalName = overrides?.name || `Vaca ${uniqueId()}`;
  const tagUid = overrides?.tagUid || randomTagUid();
  const identification = overrides?.identification || `BR-${uniqueId().slice(-6)}`;

  const res = await apiRequest<AnimalResponseDTO>(`/farms/${farmId}/animais`, {
    method: 'POST',
    token,
    body: {
      name: animalName,
      identification,
      tagUid,
    },
  });

  if (!res.ok || !res.data) {
    throw new Error(`Failed to create test animal: ${res.status} - ${JSON.stringify(res.error || res.data)}`);
  }

  return res.data;
}

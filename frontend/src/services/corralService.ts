/**
 * Service for corral CRUD, automation threshold updates, aggregated metrics, and SSE stream URLs.
 */

import { apiClient, resolveUrl } from './apiClient';
import { sanitizeMacAddress } from './macUtils';
import type {
  CorralRequestDTO,
  CorralResponseDTO,
  CorralParametersRequestDTO,
  CorralMetricsResponseDTO,
} from '../types/api';

/**
 * Lists all corrals belonging to a farm.
 *
 * @endpoint GET /api/v1/farms/{farmId}/currais
 */
export async function listCorrais(farmId: number): Promise<CorralResponseDTO[]> {
  const safeFarmId = encodeURIComponent(String(farmId));
  return apiClient<CorralResponseDTO[]>(`/farms/${safeFarmId}/currais`, {
    method: 'GET',
  });
}

/**
 * Fetches corral details by ID using either the flat or farm-nested route.
 *
 * @endpoint GET /api/v1/currais/{corralId}
 */
export async function getCorral(corralId: number, farmId?: number): Promise<CorralResponseDTO> {
  const safeCorralId = encodeURIComponent(String(corralId));
  const endpoint = farmId !== undefined
    ? `/farms/${encodeURIComponent(String(farmId))}/currais/${safeCorralId}`
    : `/currais/${safeCorralId}`;

  return apiClient<CorralResponseDTO>(endpoint, {
    method: 'GET',
  });
}

/**
 * Creates a corral under a farm after normalizing its 12-hex MAC address via {@link sanitizeMacAddress}.
 *
 * @endpoint POST /api/v1/farms/{farmId}/currais
 */
export async function createCorral(farmId: number, data: CorralRequestDTO): Promise<CorralResponseDTO> {
  const safeFarmId = encodeURIComponent(String(farmId));
  const payload: CorralRequestDTO = {
    ...data,
    macAddress: data.macAddress ? sanitizeMacAddress(data.macAddress) : data.macAddress,
  };

  return apiClient<CorralResponseDTO>(`/farms/${safeFarmId}/currais`, {
    method: 'POST',
    body: payload,
  });
}

/**
 * Updates corral details and sanitized MAC address via flat or nested route.
 *
 * @endpoint PUT /api/v1/currais/{corralId}
 */
export async function updateCorral(
  corralId: number,
  data: CorralRequestDTO,
  farmId?: number
): Promise<CorralResponseDTO> {
  const safeCorralId = encodeURIComponent(String(corralId));
  const endpoint = farmId !== undefined
    ? `/farms/${encodeURIComponent(String(farmId))}/currais/${safeCorralId}`
    : `/currais/${safeCorralId}`;

  const payload: CorralRequestDTO = {
    ...data,
    macAddress: data.macAddress ? sanitizeMacAddress(data.macAddress) : data.macAddress,
  };

  return apiClient<CorralResponseDTO>(endpoint, {
    method: 'PUT',
    body: payload,
  });
}

/**
 * Updates operational automation thresholds ({@code cleanTime}, {@code limitOdor}, {@code pumpDurationSeconds}).
 * Passing {@code cleanTime: null} disables the daily scheduled cleaning.
 *
 * @endpoint PUT /api/v1/currais/{corralId}/parametros
 */
export async function updateParameters(
  corralId: number,
  data: CorralParametersRequestDTO,
  farmId?: number
): Promise<CorralResponseDTO> {
  const safeCorralId = encodeURIComponent(String(corralId));
  const endpoint = farmId !== undefined
    ? `/farms/${encodeURIComponent(String(farmId))}/currais/${safeCorralId}/parametros`
    : `/currais/${safeCorralId}/parametros`;

  return apiClient<CorralResponseDTO>(endpoint, {
    method: 'PUT',
    body: data,
  });
}

/**
 * Fetches aggregated corral KPI metrics (occupancy, today's washes, device liveness, open pendencies).
 *
 * @endpoint GET /api/v1/currais/{corralId}/metricas
 */
export async function getMetrics(
  corralId: number,
  farmId?: number
): Promise<CorralMetricsResponseDTO> {
  const safeCorralId = encodeURIComponent(String(corralId));
  const endpoint = farmId !== undefined
    ? `/farms/${encodeURIComponent(String(farmId))}/currais/${safeCorralId}/metricas`
    : `/currais/${safeCorralId}/metricas`;

  return apiClient<CorralMetricsResponseDTO>(endpoint, {
    method: 'GET',
  });
}

/**
 * Deletes a corral; rejected by the backend when a cleaning cycle is active or pending.
 *
 * @endpoint DELETE /api/v1/currais/{corralId}
 */
export async function deleteCorral(corralId: number, farmId?: number): Promise<void> {
  const safeCorralId = encodeURIComponent(String(corralId));
  const endpoint = farmId !== undefined
    ? `/farms/${encodeURIComponent(String(farmId))}/currais/${safeCorralId}`
    : `/currais/${safeCorralId}`;

  await apiClient<void>(endpoint, {
    method: 'DELETE',
  });
}

/**
 * Builds the Server-Sent Events stream URL for a corral, appending {@code ?token=} for browser
 * {@code EventSource} compatibility because native {@code EventSource} cannot send Authorization headers.
 *
 * @endpoint GET /api/v1/currais/{corralId}/stream
 */
export function getCorralStreamUrl(
  corralId: number,
  farmId?: number | null,
  token?: string | null
): string {
  const safeCorralId = encodeURIComponent(String(corralId));
  const endpoint = farmId !== undefined && farmId !== null
    ? `/farms/${encodeURIComponent(String(farmId))}/currais/${safeCorralId}/stream`
    : `/currais/${safeCorralId}/stream`;

  const baseUrl = resolveUrl(endpoint);
  if (token) {
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}token=${encodeURIComponent(token)}`;
  }
  return baseUrl;
}

export const corralService = {
  listCorrais,
  getCorral,
  createCorral,
  updateCorral,
  updateParameters,
  getMetrics,
  deleteCorral,
  getCorralStreamUrl,
};

export default corralService;


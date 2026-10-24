/**
 * src/services/corralService.ts
 * Gestão de Currais, Parâmetros Operacionais e Métricas de Telemetria/Ocupação.
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
 * Lista todos os currais vinculados a uma fazenda.
 * Endpoint: GET /api/v1/farms/{farmId}/currais
 */
export async function listCorrais(farmId: number): Promise<CorralResponseDTO[]> {
  const safeFarmId = encodeURIComponent(String(farmId));
  return apiClient<CorralResponseDTO[]>(`/farms/${safeFarmId}/currais`, {
    method: 'GET',
  });
}

/**
 * Busca detalhes de um curral específico por ID (rota direta ou aninhada).
 * Endpoint: GET /api/v1/currais/{corralId} ou GET /api/v1/farms/{farmId}/currais/{corralId}
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
 * Cadastra um novo curral vinculado à fazenda informada com sanitização do MAC Address.
 * Endpoint: POST /api/v1/farms/{farmId}/currais
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
 * Atualiza os dados cadastrais de um curral existente.
 * Endpoint: PUT /api/v1/currais/{corralId} ou PUT /api/v1/farms/{farmId}/currais/{corralId}
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
 * Atualiza os parâmetros operacionais (horário de limpeza, limite de odor, duração da bomba).
 * Nota: Enviar cleanTime como null desativa o agendamento diário.
 * Endpoint: PUT /api/v1/currais/{corralId}/parametros
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
 * Consulta métricas consolidadas do curral (lotação atual, limpezas hoje, conectividade, pendências).
 * Endpoint: GET /api/v1/currais/{corralId}/metricas
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
 * Exclui um curral (não permitido caso haja ciclo de limpeza em andamento).
 * Endpoint: DELETE /api/v1/currais/{corralId}
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
 * Constrói a URL para a conexão SSE de streaming de eventos em tempo real do curral.
 * Endpoints suportados no backend:
 * - GET /api/v1/currais/{corralId}/stream
 * - GET /api/v1/farms/{farmId}/currais/{corralId}/stream
 * Suporta passagem de token via query parameter (?token=...) para compatibilidade nativa com EventSource do browser.
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


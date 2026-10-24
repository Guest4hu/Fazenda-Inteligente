/**
 * src/services/pendencyService.ts
 * Gestão e Resolução de Pendências de Identificação RFID (Tags desconhecidas).
 */

import { apiClient } from './apiClient';
import type {
  IdentifyPendencyResponseDTO,
  ResolvePendencyRequestDTO,
} from '../types/api';

/**
 * Lista pendências de identificação de tags RFID não associadas em um curral.
 * Endpoint: GET /api/v1/currais/{corralId}/pendencias ou GET /api/v1/farms/{farmId}/currais/{corralId}/pendencias
 */
export async function listPendencies(
  corralId: number,
  farmId?: number
): Promise<IdentifyPendencyResponseDTO[]> {
  const safeCorralId = encodeURIComponent(String(corralId));
  const endpoint = farmId !== undefined
    ? `/farms/${encodeURIComponent(String(farmId))}/currais/${safeCorralId}/pendencias`
    : `/currais/${safeCorralId}/pendencias`;

  return apiClient<IdentifyPendencyResponseDTO[]>(endpoint, {
    method: 'GET',
  });
}

/**
 * Resolve uma pendência de identificação vinculando a tag lida a um animal existente.
 * Endpoint: POST /api/v1/pendencias/{pendencyId}/resolver (ou PUT)
 */
export async function resolvePendency(
  pendencyId: number,
  data: ResolvePendencyRequestDTO,
  method: 'POST' | 'PUT' = 'POST'
): Promise<IdentifyPendencyResponseDTO> {
  const safePendencyId = encodeURIComponent(String(pendencyId));
  return apiClient<IdentifyPendencyResponseDTO>(`/pendencias/${safePendencyId}/resolver`, {
    method,
    body: data,
  });
}

export const pendencyService = {
  listPendencies,
  resolvePendency,
};

export default pendencyService;

/**
 * Service for listing and resolving unrecognized RFID identification pendencies.
 */

import { apiClient } from './apiClient';
import type {
  IdentifyPendencyResponseDTO,
  ResolvePendencyRequestDTO,
} from '../types/api';

/**
 * Lists unresolved RFID identification alerts for a corral via flat or farm-nested paths.
 *
 * @endpoint GET /api/v1/currais/{corralId}/pendencias
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
 * Resolves an open identification pendency by binding the detected tag to an existing farm animal.
 *
 * @endpoint POST|PUT /api/v1/pendencias/{pendencyId}/resolver
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

/**
 * src/services/farmService.ts
 * Gestão de Fazendas do Produtor Rural Autenticado.
 */

import { apiClient } from './apiClient';
import type { FarmRequestDTO, FarmResponseDTO } from '../types/api';

/**
 * Lista todas as fazendas do produtor rural autenticado.
 * Endpoint: GET /api/v1/farms
 */
export async function listFarms(): Promise<FarmResponseDTO[]> {
  return apiClient<FarmResponseDTO[]>('/farms', {
    method: 'GET',
  });
}

/**
 * Cadastra uma nova fazenda.
 * Endpoint: POST /api/v1/farms
 */
export async function createFarm(data: FarmRequestDTO): Promise<FarmResponseDTO> {
  return apiClient<FarmResponseDTO>('/farms', {
    method: 'POST',
    body: data,
  });
}

/**
 * Atualiza o nome de uma fazenda existente.
 * Endpoint: PUT /api/v1/farms/{farmId}
 */
export async function updateFarm(farmId: number, data: FarmRequestDTO): Promise<FarmResponseDTO> {
  const safeId = encodeURIComponent(String(farmId));
  return apiClient<FarmResponseDTO>(`/farms/${safeId}`, {
    method: 'PUT',
    body: data,
  });
}

/**
 * Exclui uma fazenda (caso não haja limpezas ativas).
 * Endpoint: DELETE /api/v1/farms/{farmId}
 */
export async function deleteFarm(farmId: number): Promise<void> {
  const safeId = encodeURIComponent(String(farmId));
  await apiClient<void>(`/farms/${safeId}`, {
    method: 'DELETE',
  });
}

export const farmService = {
  listFarms,
  createFarm,
  updateFarm,
  deleteFarm,
};

export default farmService;

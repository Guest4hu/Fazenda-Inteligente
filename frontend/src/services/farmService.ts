/**
 * Service for authenticated producer farm CRUD operations.
 */

import { apiClient } from './apiClient';
import type { FarmRequestDTO, FarmResponseDTO } from '../types/api';

/**
 * Lists all farms belonging to the authenticated user.
 *
 * @endpoint GET /api/v1/farms
 */
export async function listFarms(): Promise<FarmResponseDTO[]> {
  return apiClient<FarmResponseDTO[]>('/farms', {
    method: 'GET',
  });
}

/**
 * Creates a new farm owned by the authenticated user.
 *
 * @endpoint POST /api/v1/farms
 */
export async function createFarm(data: FarmRequestDTO): Promise<FarmResponseDTO> {
  return apiClient<FarmResponseDTO>('/farms', {
    method: 'POST',
    body: data,
  });
}

/**
 * Renames an existing farm.
 *
 * @endpoint PUT /api/v1/farms/{farmId}
 */
export async function updateFarm(farmId: number, data: FarmRequestDTO): Promise<FarmResponseDTO> {
  const safeId = encodeURIComponent(String(farmId));
  return apiClient<FarmResponseDTO>(`/farms/${safeId}`, {
    method: 'PUT',
    body: data,
  });
}

/**
 * Deletes a farm when none of its corrals have active wash commands.
 *
 * @endpoint DELETE /api/v1/farms/{farmId}
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

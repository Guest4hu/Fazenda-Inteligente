/**
 * Service for triggering wash commands, issuing emergency stops, and reading wash history.
 */

import { apiClient } from './apiClient';
import type { CleanCmdRequestDTO, CleanCmdResponseDTO } from '../types/api';

/**
 * Dispatches a wash command and awaits hardware ACK; fails with 409 Conflict if any biological,
 * concurrency, or device-liveness lock rejects execution.
 *
 * @endpoint POST /api/v1/currais/{corralId}/limpeza
 */
export async function triggerCleaning(
  corralId: number,
  data?: CleanCmdRequestDTO
): Promise<CleanCmdResponseDTO> {
  const safeCorralId = encodeURIComponent(String(corralId));
  return apiClient<CleanCmdResponseDTO>(`/currais/${safeCorralId}/limpeza`, {
    method: 'POST',
    body: data,
  });
}

/**
 * Clears active command locks and sends an immediate pump shutoff command to the ESP32.
 *
 * @endpoint POST /api/v1/currais/{corralId}/limpeza/parar
 */
export async function stopCleaning(corralId: number): Promise<CleanCmdResponseDTO> {
  const safeCorralId = encodeURIComponent(String(corralId));
  return apiClient<CleanCmdResponseDTO>(`/currais/${safeCorralId}/limpeza/parar`, {
    method: 'POST',
  });
}

/**
 * Lists corral cleaning commands ordered newest-first.
 *
 * @endpoint GET /api/v1/currais/{corralId}/limpezas
 */
export async function listCleanHistory(corralId: number): Promise<CleanCmdResponseDTO[]> {
  const safeCorralId = encodeURIComponent(String(corralId));
  return apiClient<CleanCmdResponseDTO[]>(`/currais/${safeCorralId}/limpezas`, {
    method: 'GET',
  });
}

export const cleanService = {
  triggerCleaning,
  stopCleaning,
  listCleanHistory,
};

export default cleanService;

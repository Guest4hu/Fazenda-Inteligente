/**
 * src/services/cleanService.ts
 * Disparo e Histórico de Comandos de Limpeza com Travas Biológicas e de Conectividade.
 */

import { apiClient } from './apiClient';
import type { CleanCmdRequestDTO, CleanCmdResponseDTO } from '../types/api';

/**
 * Aciona a bomba de limpeza do curral (submetido às 3 travas de segurança: animal presente, bomba ativa, conectividade).
 * Endpoint: POST /api/v1/currais/{corralId}/limpeza
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
 * Consulta o histórico de acionamentos de limpeza do curral.
 * Endpoint: GET /api/v1/currais/{corralId}/limpezas
 */
export async function listCleanHistory(corralId: number): Promise<CleanCmdResponseDTO[]> {
  const safeCorralId = encodeURIComponent(String(corralId));
  return apiClient<CleanCmdResponseDTO[]>(`/currais/${safeCorralId}/limpezas`, {
    method: 'GET',
  });
}

export const cleanService = {
  triggerCleaning,
  listCleanHistory,
};

export default cleanService;

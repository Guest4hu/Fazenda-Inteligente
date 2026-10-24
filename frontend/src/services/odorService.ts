/**
 * src/services/odorService.ts
 * Telemetria de Leituras de Odor e Qualidade do Ar (Sensor MQ-135).
 */

import { apiClient } from './apiClient';
import type { OdorTelemetryResponseDTO } from '../types/api';

/**
 * Consulta até as últimas 30 leituras de telemetria de odor do curral para plotagem do gráfico.
 * Endpoint: GET /api/v1/currais/{corralId}/odor
 */
export async function getOdorReadings(corralId: number): Promise<OdorTelemetryResponseDTO[]> {
  const safeCorralId = encodeURIComponent(String(corralId));
  return apiClient<OdorTelemetryResponseDTO[]>(`/currais/${safeCorralId}/odor`, {
    method: 'GET',
  });
}

export const odorService = {
  getOdorReadings,
};

export default odorService;

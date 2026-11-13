/**
 * Service for fetching MQ-135 gas and environmental telemetry samples.
 */

import { apiClient } from './apiClient';
import type { OdorTelemetryResponseDTO } from '../types/api';

/**
 * Fetches up to the 30 most recent odor telemetry samples for a corral.
 *
 * @endpoint GET /api/v1/currais/{corralId}/odor
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

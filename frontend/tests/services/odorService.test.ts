import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as odorService from '../../src/services/odorService';
import { setToken } from '../../src/services/apiClient';
import { mockFetchSuccess, mockFetchProblemDetail, getFetchCallDetails } from '../mockApi';

describe('odorService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    setToken('test-token');
  });

  describe('Endpoint 25: GET /api/v1/currais/{corralId}/odor', () => {
    it('deve consultar as últimas 30 leituras de odor do sensor MQ-135', async () => {
      const readings = [
        { id: 42, corralId: 1, value: 310, instant: '2026-10-23T18:14:55' },
        { id: 41, corralId: 1, value: 295, instant: '2026-10-23T18:14:50' },
      ];
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        mockFetchSuccess(readings, 200)
      );

      const result = await odorService.getOdorReadings(1);
      expect(result).toEqual(readings);

      const { url, options } = getFetchCallDetails(fetchSpy);
      expect(url).toMatch(/\/currais\/1\/odor$/);
      expect(options.method).toBe('GET');
    });

    it('deve propagar erro 404 se curral não for encontrado', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        mockFetchProblemDetail({ status: 404, detail: 'Curral não encontrado' }, 404)
      );

      await expect(odorService.getOdorReadings(999)).rejects.toThrow();
    });
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as pendencyService from '../../src/services/pendencyService';
import { setToken } from '../../src/services/apiClient';
import { mockFetchSuccess, mockFetchProblemDetail, getFetchCallDetails } from '../mockApi';

describe('pendencyService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    setToken('test-token');
  });

  describe('Endpoint 21: GET /api/v1/currais/{corralId}/pendencias', () => {
    it('deve listar pendências de identificação RFID abertas via rota direta', async () => {
      const pendencies = [
        {
          id: 5,
          corralId: 1,
          tagUid: 'AABB9988',
          typeEvent: 'ENTROU' as const,
          instant: '2026-10-23T18:05:12',
          resolved: false,
          animalIdResolved: null,
          animalNameResolved: null,
          resolvedAt: null,
        },
      ];
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        mockFetchSuccess(pendencies, 200)
      );

      const result = await pendencyService.listPendencies(1);
      expect(result).toEqual(pendencies);

      const { url } = getFetchCallDetails(fetchSpy);
      expect(url).toMatch(/\/currais\/1\/pendencias$/);
    });

    it('deve listar pendências via rota aninhada quando farmId for informado', async () => {
      const pendencies = [
        {
          id: 6,
          corralId: 2,
          tagUid: 'CCDD1122',
          typeEvent: 'SAIU' as const,
          instant: '2026-10-23T18:10:00',
          resolved: false,
          animalIdResolved: null,
          animalNameResolved: null,
          resolvedAt: null,
        },
      ];
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        mockFetchSuccess(pendencies, 200)
      );

      const result = await pendencyService.listPendencies(2, 3);
      expect(result).toEqual(pendencies);

      const { url } = getFetchCallDetails(fetchSpy);
      expect(url).toMatch(/\/farms\/3\/currais\/2\/pendencias$/);
    });
  });

  describe('Endpoint 22: POST /api/v1/pendencias/{pendencyId}/resolver', () => {
    it('deve resolver pendência vinculando animal cadastrado via POST por padrão', async () => {
      const resolvedResp = {
        id: 5,
        corralId: 1,
        tagUid: 'AABB9988',
        typeEvent: 'ENTROU' as const,
        instant: '2026-10-23T18:05:12',
        resolved: true,
        animalIdResolved: 42,
        animalNameResolved: 'Novilha Estrela',
        resolvedAt: '2026-10-23T18:14:30',
      };
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        mockFetchSuccess(resolvedResp, 200)
      );

      const result = await pendencyService.resolvePendency(5, { animalId: 42 });
      expect(result).toEqual(resolvedResp);

      const { url, options, body } = getFetchCallDetails(fetchSpy);
      expect(url).toMatch(/\/pendencias\/5\/resolver$/);
      expect(options.method).toBe('POST');
      expect(body).toEqual({ animalId: 42 });
    });

    it('deve suportar resolução via PUT quando especificado', async () => {
      const resolvedResp = {
        id: 5,
        corralId: 1,
        tagUid: 'AABB9988',
        typeEvent: 'ENTROU' as const,
        instant: '2026-10-23T18:05:12',
        resolved: true,
        animalIdResolved: 42,
        animalNameResolved: 'Novilha Estrela',
        resolvedAt: '2026-10-23T18:14:30',
      };
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        mockFetchSuccess(resolvedResp, 200)
      );

      const result = await pendencyService.resolvePendency(5, { animalId: 42 }, 'PUT');
      expect(result).toEqual(resolvedResp);

      const { options } = getFetchCallDetails(fetchSpy);
      expect(options.method).toBe('PUT');
    });

    it('deve capturar erro 409 se pendência já foi resolvida anteriormente', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        mockFetchProblemDetail(
          {
            status: 409,
            detail: 'Esta pendência de identificação já foi resolvida anteriormente',
          },
          409
        )
      );

      await expect(pendencyService.resolvePendency(5, { animalId: 42 })).rejects.toThrow();
    });

    it('deve capturar erro 409 se animal pertencer a outra fazenda', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        mockFetchProblemDetail(
          {
            status: 409,
            detail: 'O animal selecionado pertence a uma fazenda diferente da fazenda do curral',
          },
          409
        )
      );

      await expect(pendencyService.resolvePendency(5, { animalId: 99 })).rejects.toThrow();
    });
  });
});

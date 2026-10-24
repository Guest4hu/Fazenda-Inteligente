import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as cleanService from '../../src/services/cleanService';
import { setToken } from '../../src/services/apiClient';
import { mockFetchSuccess, mockFetchProblemDetail, getFetchCallDetails } from '../mockApi';

describe('cleanService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    setToken('test-token');
  });

  describe('Endpoint 23: POST /api/v1/currais/{corralId}/limpeza', () => {
    it('deve disparar limpeza manual com parâmetros customizados', async () => {
      const cleanResp = {
        id: '8210ae63-d609-4d2e-b584-a274990cb3dd',
        corralId: 1,
        origin: 'MANUAL' as const,
        state: 'CONCLUIDO' as const,
        secondsDuration: 20,
        createdAt: '2026-10-23T18:15:00',
        mensagem: 'Bomba acionada e confirmada com sucesso!',
      };
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        mockFetchSuccess(cleanResp, 200)
      );

      const result = await cleanService.triggerCleaning(1, {
        origin: 'MANUAL',
        secondsDuration: 20,
      });
      expect(result).toEqual(cleanResp);

      const { url, options, body } = getFetchCallDetails(fetchSpy);
      expect(url).toMatch(/\/currais\/1\/limpeza$/);
      expect(options.method).toBe('POST');
      expect(body).toEqual({ origin: 'MANUAL', secondsDuration: 20 });
    });

    it('deve disparar limpeza sem body (utilizando defaults configurados no curral)', async () => {
      const cleanResp = {
        id: 'uuid-1',
        corralId: 1,
        origin: 'MANUAL' as const,
        state: 'CONCLUIDO' as const,
        secondsDuration: 30,
        createdAt: '2026-10-23T18:15:00',
        mensagem: null,
      };
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        mockFetchSuccess(cleanResp, 200)
      );

      const result = await cleanService.triggerCleaning(1);
      expect(result).toEqual(cleanResp);
    });

    it('deve capturar erro 409 — Trava Biológica (animal presente no curral)', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        mockFetchProblemDetail(
          {
            status: 409,
            title: 'Conflito de Regra de Negócio',
            detail: 'Tem uma vaca no curral neste momento, não tem como acionar a bomba de limpeza',
          },
          409
        )
      );

      await expect(cleanService.triggerCleaning(1)).rejects.toThrow();
    });

    it('deve capturar erro 409 — Trava de Concorrência Física (bomba já em andamento)', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        mockFetchProblemDetail(
          {
            status: 409,
            title: 'Conflito de Regra de Negócio',
            detail: 'A bomba já está em andamento para este curral',
          },
          409
        )
      );

      await expect(cleanService.triggerCleaning(1)).rejects.toThrow();
    });

    it('deve capturar erro 409 — Trava de Conectividade (ESP32 offline)', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        mockFetchProblemDetail(
          {
            status: 409,
            title: 'Conflito de Regra de Negócio',
            detail: 'O dispositovo deste curral esta offline ou sem comunicação recente, Verifique a conexão antes de acionar a bomba',
          },
          409
        )
      );

      await expect(cleanService.triggerCleaning(1)).rejects.toThrow();
    });
  });

  describe('Endpoint 24: GET /api/v1/currais/{corralId}/limpezas', () => {
    it('deve consultar histórico de limpezas do curral', async () => {
      const history = [
        {
          id: 'uuid-1',
          corralId: 1,
          origin: 'MANUAL' as const,
          state: 'CONCLUIDO' as const,
          secondsDuration: 20,
          createdAt: '2026-10-23T18:15:00',
          mensagem: null,
        },
      ];
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        mockFetchSuccess(history, 200)
      );

      const result = await cleanService.listCleanHistory(1);
      expect(result).toEqual(history);

      const { url } = getFetchCallDetails(fetchSpy);
      expect(url).toMatch(/\/currais\/1\/limpezas$/);
    });
  });
});

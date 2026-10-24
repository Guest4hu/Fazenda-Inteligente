import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as corralService from '../../src/services/corralService';
import { setToken } from '../../src/services/apiClient';
import { mockFetchSuccess, mockFetchProblemDetail, getFetchCallDetails } from '../mockApi';

describe('corralService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    setToken('test-token');
  });

  describe('Endpoint 7: POST /api/v1/farms/{farmId}/currais', () => {
    it('deve cadastrar curral na fazenda e sanitizar MAC Address com colons', async () => {
      const mockCorral = {
        id: 1,
        farmId: 10,
        name: 'Curral 01',
        macAddress: '240AC4000110',
        cleanTime: '06:30:00',
        limitOdor: 400,
        pumpDurationSeconds: 30,
        deviceStatus: 'OFFLINE' as const,
        lastSeenAt: null,
      };
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        mockFetchSuccess(mockCorral, 201)
      );

      const payload = {
        name: 'Curral 01',
        macAddress: '24:0A:C4:00:01:10', // formatted with colons
        cleanTime: '06:30:00',
        limitOdor: 400,
        pumpDurationSeconds: 30,
      };
      const result = await corralService.createCorral(10, payload);
      expect(result).toEqual(mockCorral);

      const { url, options, body } = getFetchCallDetails(fetchSpy);
      expect(url).toMatch(/\/farms\/10\/currais$/);
      expect(options.method).toBe('POST');
      expect(body.macAddress).toBe('240AC4000110'); // sanitized
    });

    it('deve capturar erro 409 se MAC Address já estiver registrado', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        mockFetchProblemDetail(
          {
            status: 409,
            detail: 'Ja existe um curral cadastrado com este MAC Address',
          },
          409
        )
      );

      await expect(
        corralService.createCorral(1, { name: 'C', macAddress: '240AC4000110' })
      ).rejects.toThrow();
    });
  });

  describe('Endpoint 8: GET /api/v1/farms/{farmId}/currais', () => {
    it('deve listar currais da fazenda', async () => {
      const corralsList = [{ id: 1, name: 'Curral Principal' }];
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        mockFetchSuccess(corralsList, 200)
      );

      const result = await corralService.listCorrais(10);
      expect(result).toEqual(corralsList);
      const { url, options } = getFetchCallDetails(fetchSpy);
      expect(url).toMatch(/\/farms\/10\/currais$/);
      expect(options.method).toBe('GET');
    });
  });

  describe('Endpoint 9: GET /api/v1/currais/{corralId}', () => {
    it('deve buscar curral por ID via rota direta', async () => {
      const corral = { id: 5, name: 'Curral Norte' };
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        mockFetchSuccess(corral, 200)
      );

      const result = await corralService.getCorral(5);
      expect(result).toEqual(corral);
      const { url } = getFetchCallDetails(fetchSpy);
      expect(url).toMatch(/\/currais\/5$/);
    });

    it('deve buscar curral por ID via rota aninhada quando farmId for informado', async () => {
      const corral = { id: 5, farmId: 12, name: 'Curral Norte Aninhado' };
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        mockFetchSuccess(corral, 200)
      );

      const result = await corralService.getCorral(5, 12);
      expect(result).toEqual(corral);
      const { url } = getFetchCallDetails(fetchSpy);
      expect(url).toMatch(/\/farms\/12\/currais\/5$/);
    });
  });

  describe('Endpoint 10: PUT /api/v1/currais/{corralId}', () => {
    it('deve atualizar dados cadastrais do curral e sanitizar MAC', async () => {
      const updated = { id: 5, name: 'Curral Norte Atualizado' };
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        mockFetchSuccess(updated, 200)
      );

      const payload = { name: 'Curral Norte Atualizado', macAddress: 'aa-bb-cc-dd-ee-ff' };
      const result = await corralService.updateCorral(5, payload);
      expect(result).toEqual(updated);
      const { url, options, body } = getFetchCallDetails(fetchSpy);
      expect(url).toMatch(/\/currais\/5$/);
      expect(options.method).toBe('PUT');
      expect(body.macAddress).toBe('AABBCCDDEEFF');
    });
  });

  describe('Endpoint 11: PUT /api/v1/currais/{corralId}/parametros', () => {
    it('deve atualizar parâmetros operacionais (horário, limite odor, duração bomba)', async () => {
      const updated = { id: 5, cleanTime: '08:00:00', limitOdor: 350, pumpDurationSeconds: 25 };
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        mockFetchSuccess(updated, 200)
      );

      const payload = { cleanTime: '08:00:00', limitOdor: 350, pumpDurationSeconds: 25 };
      const result = await corralService.updateParameters(5, payload);
      expect(result).toEqual(updated);
      const { url, options, body } = getFetchCallDetails(fetchSpy);
      expect(url).toMatch(/\/currais\/5\/parametros$/);
      expect(options.method).toBe('PUT');
      expect(body).toEqual(payload);
    });

    it('deve permitir desativar agendamento diário enviando cleanTime como null', async () => {
      const updated = { id: 5, cleanTime: null };
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        mockFetchSuccess(updated, 200)
      );

      await corralService.updateParameters(5, { cleanTime: null });
      const { body } = getFetchCallDetails(fetchSpy);
      expect(body.cleanTime).toBeNull();
    });
  });

  describe('Endpoint 12: GET /api/v1/currais/{corralId}/metricas', () => {
    it('deve consultar métricas consolidadas do dashboard', async () => {
      const metrics = {
        corralId: 5,
        corralName: 'Curral 5',
        farmId: 1,
        farmName: 'Fazenda Modelo',
        totalAnimaisNoCurral: 3,
        totalAnimaisNaFazenda: 20,
        limpezasHojeTotal: 2,
        limpezasHojeManual: 1,
        limpezasHojeOdor: 1,
        limpezasHojeAutomatica: 0,
        deviceStatus: 'ONLINE' as const,
        lastSeenAt: '2026-10-23T18:00:00',
        pendenciasAbertas: 0,
      };
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        mockFetchSuccess(metrics, 200)
      );

      const result = await corralService.getMetrics(5);
      expect(result).toEqual(metrics);
      const { url } = getFetchCallDetails(fetchSpy);
      expect(url).toMatch(/\/currais\/5\/metricas$/);
    });
  });

  describe('Endpoint 13: DELETE /api/v1/currais/{corralId}', () => {
    it('deve excluir curral', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        mockFetchSuccess(null, 204)
      );

      await corralService.deleteCorral(5);
      const { url, options } = getFetchCallDetails(fetchSpy);
      expect(url).toMatch(/\/currais\/5$/);
      expect(options.method).toBe('DELETE');
    });
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as farmService from '../../src/services/farmService';
import { setToken } from '../../src/services/apiClient';
import { mockFetchSuccess, mockFetchProblemDetail, getFetchCallDetails } from '../mockApi';

describe('farmService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    setToken('test-token');
  });

  describe('Endpoint 3: POST /api/v1/farms', () => {
    it('deve cadastrar nova fazenda enviando Bearer token e payload', async () => {
      const createdFarm = { id: 1, name: 'Fazenda Santa Luzia', createdAt: '2026-10-23T14:30:00' };
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        mockFetchSuccess(createdFarm, 201)
      );

      const result = await farmService.createFarm({ name: 'Fazenda Santa Luzia' });
      expect(result).toEqual(createdFarm);

      const { url, options, body, headers } = getFetchCallDetails(fetchSpy);
      expect(url).toMatch(/\/farms$/);
      expect(options.method).toBe('POST');
      expect(body).toEqual({ name: 'Fazenda Santa Luzia' });
      expect((headers as Record<string, string>)['Authorization']).toBe('Bearer test-token');
    });

    it('deve capturar erro 409 quando o usuário já tiver fazenda com mesmo nome', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        mockFetchProblemDetail(
          {
            status: 409,
            detail: 'Voce ja possui uma fazenda cadastrada com este nome: Fazenda Santa Luzia',
          },
          409
        )
      );

      await expect(farmService.createFarm({ name: 'Fazenda Santa Luzia' })).rejects.toThrow();
    });
  });

  describe('Endpoint 4: GET /api/v1/farms', () => {
    it('deve listar fazendas do usuário autenticado', async () => {
      const farmsList = [{ id: 1, name: 'Fazenda 1', createdAt: '2026-10-23T10:00:00' }];
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        mockFetchSuccess(farmsList, 200)
      );

      const result = await farmService.listFarms();
      expect(result).toEqual(farmsList);

      const { url, options, headers } = getFetchCallDetails(fetchSpy);
      expect(url).toMatch(/\/farms$/);
      expect(options.method).toBe('GET');
      expect((headers as Record<string, string>)['Authorization']).toBe('Bearer test-token');
    });
  });

  describe('Endpoint 5: PUT /api/v1/farms/{farmId}', () => {
    it('deve atualizar nome da fazenda', async () => {
      const updatedFarm = { id: 1, name: 'Fazenda Renovada', createdAt: '2026-10-23T10:00:00' };
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        mockFetchSuccess(updatedFarm, 200)
      );

      const result = await farmService.updateFarm(1, { name: 'Fazenda Renovada' });
      expect(result).toEqual(updatedFarm);

      const { url, options, body } = getFetchCallDetails(fetchSpy);
      expect(url).toMatch(/\/farms\/1$/);
      expect(options.method).toBe('PUT');
      expect(body).toEqual({ name: 'Fazenda Renovada' });
    });

    it('deve tratar 403 Forbidden se fazenda pertencer a outro produtor', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        mockFetchProblemDetail(
          { status: 403, detail: 'Você não tem permissão para editar esta fazenda' },
          403
        )
      );

      await expect(farmService.updateFarm(99, { name: 'Hack' })).rejects.toThrow();
    });
  });

  describe('Endpoint 6: DELETE /api/v1/farms/{farmId}', () => {
    it('deve excluir fazenda com retorno 204 No Content', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        mockFetchSuccess(null, 204)
      );

      await farmService.deleteFarm(1);
      const { url, options } = getFetchCallDetails(fetchSpy);
      expect(url).toMatch(/\/farms\/1$/);
      expect(options.method).toBe('DELETE');
    });

    it('deve propagar erro 409 se houver curral com limpeza em andamento', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        mockFetchProblemDetail(
          {
            status: 409,
            detail: 'Não é possível excluir a fazenda pois existe um curral com limpeza em andamento',
          },
          409
        )
      );

      await expect(farmService.deleteFarm(1)).rejects.toThrow();
    });
  });
});

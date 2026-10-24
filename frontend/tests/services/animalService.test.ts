import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as animalService from '../../src/services/animalService';
import { setToken } from '../../src/services/apiClient';
import { mockFetchSuccess, mockFetchProblemDetail, getFetchCallDetails } from '../mockApi';

describe('animalService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    setToken('test-token');
  });

  describe('Endpoint 14: POST /api/v1/farms/{farmId}/animais', () => {
    it('deve cadastrar animal com tag RFID na fazenda', async () => {
      const created = {
        id: 1,
        farmId: 2,
        name: 'Vaca Mimosa',
        identification: 'BR-2026-01',
        tagUid: '01020304',
        currentCorralId: null,
        currentCorralName: null,
      };
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        mockFetchSuccess(created, 201)
      );

      const payload = { name: 'Vaca Mimosa', identification: 'BR-2026-01', tagUid: '01020304' };
      const result = await animalService.createAnimal(2, payload);
      expect(result).toEqual(created);

      const { url, options, body } = getFetchCallDetails(fetchSpy);
      expect(url).toMatch(/\/farms\/2\/animais$/);
      expect(options.method).toBe('POST');
      expect(body).toEqual(payload);
    });

    it('deve capturar erro 409 se Tag RFID já pertencer a outro animal', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        mockFetchProblemDetail(
          {
            status: 409,
            detail: 'Já existe um animal cadastrado com esta Tag RFID: 01020304',
          },
          409
        )
      );

      await expect(
        animalService.createAnimal(2, { name: 'Vaca 2', tagUid: '01020304' })
      ).rejects.toThrow();
    });
  });

  describe('Endpoint 15: GET /api/v1/farms/{farmId}/animais', () => {
    it('deve listar animais da fazenda', async () => {
      const list = [{ id: 1, name: 'Vaca Mimosa', tagUid: '01020304' }];
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        mockFetchSuccess(list, 200)
      );

      const result = await animalService.listAnimals(2);
      expect(result).toEqual(list);
      const { url } = getFetchCallDetails(fetchSpy);
      expect(url).toMatch(/\/farms\/2\/animais$/);
    });
  });

  describe('Endpoint 16: GET /api/v1/animais/{animalId}', () => {
    it('deve buscar animal por ID via rota direta', async () => {
      const animal = { id: 1, name: 'Vaca Mimosa' };
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        mockFetchSuccess(animal, 200)
      );

      const result = await animalService.getAnimal(1);
      expect(result).toEqual(animal);
      const { url } = getFetchCallDetails(fetchSpy);
      expect(url).toMatch(/\/animais\/1$/);
    });

    it('deve buscar animal por ID via rota aninhada quando farmId for informado', async () => {
      const animal = { id: 1, farmId: 4, name: 'Vaca Mimosa Aninhada' };
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        mockFetchSuccess(animal, 200)
      );

      const result = await animalService.getAnimal(1, 4);
      expect(result).toEqual(animal);
      const { url } = getFetchCallDetails(fetchSpy);
      expect(url).toMatch(/\/farms\/4\/animais\/1$/);
    });
  });

  describe('Endpoint 17: PUT /api/v1/animais/{animalId}', () => {
    it('deve atualizar animal', async () => {
      const updated = { id: 1, name: 'Mimosa II' };
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        mockFetchSuccess(updated, 200)
      );

      const payload = { name: 'Mimosa II', tagUid: '01020304' };
      const result = await animalService.updateAnimal(1, payload);
      expect(result).toEqual(updated);
      const { url, options, body } = getFetchCallDetails(fetchSpy);
      expect(url).toMatch(/\/animais\/1$/);
      expect(options.method).toBe('PUT');
      expect(body).toEqual(payload);
    });
  });

  describe('Endpoint 18: DELETE /api/v1/animais/{animalId}', () => {
    it('deve excluir animal', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        mockFetchSuccess(null, 204)
      );

      await animalService.deleteAnimal(1);
      const { url, options } = getFetchCallDetails(fetchSpy);
      expect(url).toMatch(/\/animais\/1$/);
      expect(options.method).toBe('DELETE');
    });
  });

  describe('Endpoint 19: POST /api/v1/currais/{corralId}/presenca', () => {
    it('deve registrar presença de entrada/saída (ENTROU/SAIU)', async () => {
      const eventResp = {
        id: 10,
        corralId: 5,
        corralName: 'Curral 01',
        animalId: 1,
        animalName: 'Vaca Mimosa',
        tagUid: '01020304',
        typeEvent: 'ENTROU' as const,
        eventOrigin: 'MANUAL' as const,
        instant: '2026-10-23T18:12:00',
      };
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        mockFetchSuccess(eventResp, 201)
      );

      const payload = {
        tagUid: '01020304',
        typeEvent: 'ENTROU' as const,
        origin: 'MANUAL' as const,
      };
      const result = await animalService.sendPresence(5, payload);
      expect(result).toEqual(eventResp);

      const { url, options, body } = getFetchCallDetails(fetchSpy);
      expect(url).toMatch(/\/currais\/5\/presenca$/);
      expect(options.method).toBe('POST');
      expect(body).toEqual(payload);
    });

    it('deve propagar erro 404 se Tag RFID não for encontrada', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        mockFetchProblemDetail(
          {
            status: 404,
            detail: 'Nenhum animal cadastrado com a Tag RFID: 999999',
          },
          404
        )
      );

      await expect(
        animalService.sendPresence(5, { tagUid: '999999', typeEvent: 'ENTROU' })
      ).rejects.toThrow();
    });
  });

  describe('Endpoint 20: GET /api/v1/currais/{corralId}/eventos', () => {
    it('deve consultar timeline de eventos do curral', async () => {
      const eventsList = [{ id: 10, tagUid: '01020304', typeEvent: 'ENTROU' as const }];
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        mockFetchSuccess(eventsList, 200)
      );

      const result = await animalService.listEvents(5);
      expect(result).toEqual(eventsList);
      const { url } = getFetchCallDetails(fetchSpy);
      expect(url).toMatch(/\/currais\/5\/eventos$/);
    });
  });
});

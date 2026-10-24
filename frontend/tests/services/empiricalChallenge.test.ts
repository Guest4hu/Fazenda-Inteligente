/**
 * tests/services/empiricalChallenge.test.ts
 * Empirical Challenger 2 - Stress Test & Verification Suite
 *
 * Challenges:
 * 1. Exact HTTP paths, methods, query strings, and payloads across all 24 backend endpoints.
 * 2. Extreme inputs for MAC address sanitization (colons, hyphens, lowercase, non-hex, length variations).
 * 3. Parameter encoding (special characters, unicode, path traversal prevention in IDs).
 * 4. RFC 7807 problem detail error scenarios (400, 401, 403, 404, 409 locks, 502/500 non-JSON).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { sanitizeMacAddress } from '../../src/services/macUtils';
import {
  apiClient,
  ApiError,
  setToken,
  clearToken,
  setOnUnauthorized,
} from '../../src/services/apiClient';
import { authService } from '../../src/services/authService';
import { farmService } from '../../src/services/farmService';
import { corralService } from '../../src/services/corralService';
import { animalService } from '../../src/services/animalService';
import { pendencyService } from '../../src/services/pendencyService';
import { cleanService } from '../../src/services/cleanService';
import { odorService } from '../../src/services/odorService';
import { mockFetchSuccess, mockFetchProblemDetail, getFetchCallDetails } from '../mockApi';

describe('Empirical Challenger 2: Extreme MAC Sanitization Stress Tests', () => {
  it('C1.1: deve aceitar formato padrão com dois pontos (AA:BB:CC:DD:EE:FF)', () => {
    expect(sanitizeMacAddress('AA:BB:CC:DD:EE:FF')).toBe('AABBCCDDEEFF');
  });

  it('C1.2: deve aceitar formato com hífens (aa-bb-cc-dd-ee-ff)', () => {
    expect(sanitizeMacAddress('aa-bb-cc-dd-ee-ff')).toBe('AABBCCDDEEFF');
  });

  it('C1.3: deve aceitar formato minúsculo sem separadores (aabbccddeeff)', () => {
    expect(sanitizeMacAddress('aabbccddeeff')).toBe('AABBCCDDEEFF');
  });

  it('C1.4: deve aceitar delimitadores misturados (pontos, traços, espaços, colons)', () => {
    expect(sanitizeMacAddress('24:0a-c4.00 01:10')).toBe('240AC4000110');
  });

  it('C1.5: deve aceitar entradas com espaços, quebras de linha e tabs antes/depois', () => {
    expect(sanitizeMacAddress(' \t\n 24:0A:C4:00:01:10 \r\n ')).toBe('240AC4000110');
  });

  it('C1.6: deve rejeitar entradas com caracteres não-hexadecimais (G-Z)', () => {
    expect(() => sanitizeMacAddress('GG:HH:II:JJ:KK:LL')).toThrow('12 hexadecimal characters');
    expect(() => sanitizeMacAddress('AA:BB:CC:DD:EE:FZ')).toThrow('12 hexadecimal characters');
    expect(() => sanitizeMacAddress('240AC400011X')).toThrow('12 hexadecimal characters');
  });

  it('C1.7: deve rejeitar comprimentos inválidos (menor ou maior que 12 hexadecimais)', () => {
    expect(() => sanitizeMacAddress('AA:BB:CC:DD:EE')).toThrow('12 hexadecimal characters'); // 10 chars
    expect(() => sanitizeMacAddress('AA:BB:CC:DD:EE:FF:00')).toThrow('12 hexadecimal characters'); // 14 chars
    expect(() => sanitizeMacAddress('A')).toThrow('12 hexadecimal characters');
    expect(() => sanitizeMacAddress('AABBCCDDEEFF001122')).toThrow('12 hexadecimal characters');
  });

  it('C1.8: deve rejeitar strings vazias ou compostas puramente de símbolos/espaços', () => {
    expect(() => sanitizeMacAddress('')).toThrow('MAC address is required');
    expect(() => sanitizeMacAddress('   :::---...   ')).toThrow('12 hexadecimal characters');
  });

  it('C1.9: deve integrar sanitização de MAC em corralService.createCorral', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchSuccess({ id: 1, name: 'Curral 1', macAddress: 'AABBCCDDEEFF' }, 201)
    );

    await corralService.createCorral(1, {
      name: 'Curral 1',
      macAddress: 'aa:bb:cc:dd:ee:ff',
    });

    const { body } = getFetchCallDetails(fetchSpy);
    expect(body.macAddress).toBe('AABBCCDDEEFF');
  });

  it('C1.10: deve abortar em corralService.createCorral antes do fetch se MAC for inválido', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await expect(
      corralService.createCorral(1, {
        name: 'Curral Inválido',
        macAddress: 'not-a-mac-address',
      })
    ).rejects.toThrow('12 hexadecimal characters');

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('Empirical Challenger 2: Parameter Encoding & Special Characters', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearToken();
  });

  it('C2.1: deve codificar caracteres especiais em IDs de rota para prevenir path traversal', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchSuccess({ id: 1, name: 'Fazenda' })
    );

    // Tentativa de path traversal em farmId
    await farmService.updateFarm(
      ('1/../admin' as unknown) as number,
      { name: 'Tentativa' }
    );

    const { url } = getFetchCallDetails(fetchSpy);
    expect(url).toContain('/api/v1/farms/1%2F..%2Fadmin');
    expect(url).not.toBe('/api/v1/farms/1/../admin');
  });

  it('C2.2: deve suportar caracteres unicode, acentos e emojis em nomes de fazenda no payload JSON', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchSuccess({ id: 1, name: 'Fazenda São José & Irmãos 🌾🐂' }, 201)
    );

    const complexName = 'Fazenda São José & Irmãos 🌾🐂 <script>alert(1)</script>';
    await farmService.createFarm({ name: complexName });

    const { body } = getFetchCallDetails(fetchSpy);
    expect(body.name).toBe(complexName);
  });

  it('C2.3: deve normalizar tagUid para maiúsculas e remover espaços ao criar animal', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchSuccess({ id: 1, farmId: 1, name: 'Mimosa', tagUid: 'TAG-123-ABC' }, 201)
    );

    await animalService.createAnimal(1, {
      name: 'Mimosa',
      tagUid: '  tag-123-abc  ',
    });

    const { body } = getFetchCallDetails(fetchSpy);
    expect(body.tagUid).toBe('TAG-123-ABC');
  });

  it('C2.4: deve aplicar origin padrão "MANUAL" e normalizar tagUid no registro de presença', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchSuccess({ id: 1, corralId: 1, tagUid: 'TAG99', typeEvent: 'ENTROU', eventOrigin: 'MANUAL' }, 201)
    );

    await animalService.sendPresence(1, {
      tagUid: '  tag99  ',
      typeEvent: 'ENTROU',
    });

    const { body } = getFetchCallDetails(fetchSpy);
    expect(body.tagUid).toBe('TAG99');
    expect(body.origin).toBe('MANUAL');
  });

  it('C2.5: deve serializar query strings com codificação URL adequada via apiClient', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchSuccess([])
    );

    await apiClient.get('/test', {
      params: {
        filter: 'São Sebastião & Cia',
        page: 2,
        active: true,
        empty: null,
        omitted: undefined,
      },
    });

    const { url } = getFetchCallDetails(fetchSpy);
    expect(url).toContain('filter=S%C3%A3o+Sebasti%C3%A3o+%26+Cia');
    expect(url).toContain('page=2');
    expect(url).toContain('active=true');
    expect(url).not.toContain('empty');
    expect(url).not.toContain('omitted');
  });
});

describe('Empirical Challenger 2: Exact Contract Verification for all 24 Backend Endpoints', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setToken('test-bearer-token');
  });

  // 1. Auth: POST /auth/register
  it('E01: POST /api/v1/auth/register deve gerar rota e headers corretos', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchSuccess({ token: 'jwt', userId: 1, name: 'Produtor', email: 'p@f.com' }, 201)
    );
    await authService.register({ name: 'Produtor', email: 'p@f.com', password: '123' });
    const { url, options, body } = getFetchCallDetails(fetchSpy);
    expect(url).toMatch(/\/api\/v1\/auth\/register$/);
    expect(options.method).toBe('POST');
    expect(body).toEqual({ name: 'Produtor', email: 'p@f.com', password: '123' });
  });

  // 2. Auth: POST /auth/login
  it('E02: POST /api/v1/auth/login deve gerar rota e headers corretos', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchSuccess({ token: 'jwt', userId: 1, name: 'Produtor', email: 'p@f.com' }, 200)
    );
    await authService.login({ email: 'p@f.com', password: '123' });
    const { url, options, body } = getFetchCallDetails(fetchSpy);
    expect(url).toMatch(/\/api\/v1\/auth\/login$/);
    expect(options.method).toBe('POST');
    expect(body).toEqual({ email: 'p@f.com', password: '123' });
  });

  // 3. Farms: POST /farms
  it('E03: POST /api/v1/farms deve gerar rota e payload corretos', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchSuccess({ id: 1, name: 'Fazenda 1' }, 201)
    );
    await farmService.createFarm({ name: 'Fazenda 1' });
    const { url, options, body } = getFetchCallDetails(fetchSpy);
    expect(url).toMatch(/\/api\/v1\/farms$/);
    expect(options.method).toBe('POST');
    expect(body).toEqual({ name: 'Fazenda 1' });
  });

  // 4. Farms: GET /farms
  it('E04: GET /api/v1/farms deve listar fazendas com Bearer token', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchSuccess([])
    );
    await farmService.listFarms();
    const { url, options, headers } = getFetchCallDetails(fetchSpy);
    expect(url).toMatch(/\/api\/v1\/farms$/);
    expect(options.method).toBe('GET');
    expect((headers as Record<string, string>)['Authorization']).toBe('Bearer test-bearer-token');
  });

  // 5. Farms: PUT /farms/{farmId}
  it('E05: PUT /api/v1/farms/{farmId} deve atualizar fazenda', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchSuccess({ id: 10, name: 'Editada' })
    );
    await farmService.updateFarm(10, { name: 'Editada' });
    const { url, options, body } = getFetchCallDetails(fetchSpy);
    expect(url).toMatch(/\/api\/v1\/farms\/10$/);
    expect(options.method).toBe('PUT');
    expect(body).toEqual({ name: 'Editada' });
  });

  // 6. Farms: DELETE /farms/{farmId}
  it('E06: DELETE /api/v1/farms/{farmId} deve excluir fazenda (204 No Content)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchSuccess(null, 204)
    );
    const result = await farmService.deleteFarm(10);
    const { url, options } = getFetchCallDetails(fetchSpy);
    expect(url).toMatch(/\/api\/v1\/farms\/10$/);
    expect(options.method).toBe('DELETE');
    expect(result).toBeUndefined();
  });

  // 7. Currais: POST /farms/{farmId}/currais
  it('E07: POST /api/v1/farms/{farmId}/currais deve cadastrar curral', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchSuccess({ id: 1, name: 'C1', macAddress: '240AC4000110' }, 201)
    );
    await corralService.createCorral(5, { name: 'C1', macAddress: '24:0A:C4:00:01:10' });
    const { url, options, body } = getFetchCallDetails(fetchSpy);
    expect(url).toMatch(/\/api\/v1\/farms\/5\/currais$/);
    expect(options.method).toBe('POST');
    expect(body.macAddress).toBe('240AC4000110');
  });

  // 8. Currais: GET /farms/{farmId}/currais
  it('E08: GET /api/v1/farms/{farmId}/currais deve listar currais da fazenda', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchSuccess([])
    );
    await corralService.listCorrais(5);
    const { url, options } = getFetchCallDetails(fetchSpy);
    expect(url).toMatch(/\/api\/v1\/farms\/5\/currais$/);
    expect(options.method).toBe('GET');
  });

  // 9. Currais: GET /currais/{corralId} (direto e aninhado)
  it('E09: GET /api/v1/currais/{corralId} deve suportar rota direta e aninhada', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchSuccess({ id: 12, name: 'C1' })
    );
    await corralService.getCorral(12);
    expect(getFetchCallDetails(fetchSpy).url).toMatch(/\/api\/v1\/currais\/12$/);

    await corralService.getCorral(12, 5);
    expect(getFetchCallDetails(fetchSpy).url).toMatch(/\/api\/v1\/farms\/5\/currais\/12$/);
  });

  // 10. Currais: PUT /currais/{corralId} (direto e aninhado)
  it('E10: PUT /api/v1/currais/{corralId} deve atualizar curral completo', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchSuccess({ id: 12, name: 'C1 Editado' })
    );
    await corralService.updateCorral(12, { name: 'C1 Editado', macAddress: '240AC4000110' });
    expect(getFetchCallDetails(fetchSpy).url).toMatch(/\/api\/v1\/currais\/12$/);

    await corralService.updateCorral(12, { name: 'C1 Editado', macAddress: '240AC4000110' }, 5);
    expect(getFetchCallDetails(fetchSpy).url).toMatch(/\/api\/v1\/farms\/5\/currais\/12$/);
  });

  // 11. Currais: DELETE /currais/{corralId} (direto e aninhado)
  it('E11: DELETE /api/v1/currais/{corralId} deve excluir curral', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchSuccess(null, 204)
    );
    await corralService.deleteCorral(12);
    expect(getFetchCallDetails(fetchSpy).url).toMatch(/\/api\/v1\/currais\/12$/);

    await corralService.deleteCorral(12, 5);
    expect(getFetchCallDetails(fetchSpy).url).toMatch(/\/api\/v1\/farms\/5\/currais\/12$/);
  });

  // 12. Currais (Parâmetros): PUT /currais/{corralId}/parametros
  it('E12: PUT /api/v1/currais/{corralId}/parametros deve atualizar parâmetros operacionais', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchSuccess({ id: 12, cleanTime: '06:00:00', limitOdor: 450, pumpDurationSeconds: 20 })
    );
    await corralService.updateParameters(12, { cleanTime: '06:00:00', limitOdor: 450, pumpDurationSeconds: 20 });
    const { url, options, body } = getFetchCallDetails(fetchSpy);
    expect(url).toMatch(/\/api\/v1\/currais\/12\/parametros$/);
    expect(options.method).toBe('PUT');
    expect(body).toEqual({ cleanTime: '06:00:00', limitOdor: 450, pumpDurationSeconds: 20 });
  });

  // 13. Currais (Métricas): GET /currais/{corralId}/metricas
  it('E13: GET /api/v1/currais/{corralId}/metricas deve consultar métricas do dashboard', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchSuccess({ corralId: 12, totalAnimaisNoCurral: 3, pendenciasAbertas: 0 })
    );
    await corralService.getMetrics(12);
    const { url, options } = getFetchCallDetails(fetchSpy);
    expect(url).toMatch(/\/api\/v1\/currais\/12\/metricas$/);
    expect(options.method).toBe('GET');
  });

  // 14. Animais: POST /farms/{farmId}/animais
  it('E14: POST /api/v1/farms/{farmId}/animais deve cadastrar animal', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchSuccess({ id: 1, name: 'Mimosa', tagUid: 'TAG10' }, 201)
    );
    await animalService.createAnimal(5, { name: 'Mimosa', tagUid: 'TAG10' });
    const { url, options, body } = getFetchCallDetails(fetchSpy);
    expect(url).toMatch(/\/api\/v1\/farms\/5\/animais$/);
    expect(options.method).toBe('POST');
    expect(body.tagUid).toBe('TAG10');
  });

  // 15. Animais: GET /farms/{farmId}/animais
  it('E15: GET /api/v1/farms/{farmId}/animais deve listar animais da fazenda', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchSuccess([])
    );
    await animalService.listAnimals(5);
    const { url, options } = getFetchCallDetails(fetchSpy);
    expect(url).toMatch(/\/api\/v1\/farms\/5\/animais$/);
    expect(options.method).toBe('GET');
  });

  // 16. Animais: GET /animais/{animalId} (direto e aninhado)
  it('E16: GET /api/v1/animais/{animalId} deve buscar animal por ID', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchSuccess({ id: 22, name: 'Estrela' })
    );
    await animalService.getAnimal(22);
    expect(getFetchCallDetails(fetchSpy).url).toMatch(/\/api\/v1\/animais\/22$/);

    await animalService.getAnimal(22, 5);
    expect(getFetchCallDetails(fetchSpy).url).toMatch(/\/api\/v1\/farms\/5\/animais\/22$/);
  });

  // 17. Animais: PUT /animais/{animalId} (direto e aninhado)
  it('E17: PUT /api/v1/animais/{animalId} deve atualizar dados do animal', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchSuccess({ id: 22, name: 'Estrela Editada' })
    );
    await animalService.updateAnimal(22, { name: 'Estrela Editada', tagUid: 'TAG22' });
    expect(getFetchCallDetails(fetchSpy).url).toMatch(/\/api\/v1\/animais\/22$/);

    await animalService.updateAnimal(22, { name: 'Estrela Editada', tagUid: 'TAG22' }, 5);
    expect(getFetchCallDetails(fetchSpy).url).toMatch(/\/api\/v1\/farms\/5\/animais\/22$/);
  });

  // 18. Animais: DELETE /animais/{animalId} (direto e aninhado)
  it('E18: DELETE /api/v1/animais/{animalId} deve excluir animal', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchSuccess(null, 204)
    );
    await animalService.deleteAnimal(22);
    expect(getFetchCallDetails(fetchSpy).url).toMatch(/\/api\/v1\/animais\/22$/);

    await animalService.deleteAnimal(22, 5);
    expect(getFetchCallDetails(fetchSpy).url).toMatch(/\/api\/v1\/farms\/5\/animais\/22$/);
  });

  // 19. Presença: POST /currais/{corralId}/presenca
  it('E19: POST /api/v1/currais/{corralId}/presenca deve registrar evento de presença', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchSuccess({ id: 1, corralId: 12, typeEvent: 'ENTROU' }, 201)
    );
    await animalService.sendPresence(12, { tagUid: 'TAG10', typeEvent: 'ENTROU' });
    const { url, options, body } = getFetchCallDetails(fetchSpy);
    expect(url).toMatch(/\/api\/v1\/currais\/12\/presenca$/);
    expect(options.method).toBe('POST');
    expect(body).toEqual({ tagUid: 'TAG10', typeEvent: 'ENTROU', origin: 'MANUAL' });
  });

  // 20. Presença: GET /currais/{corralId}/eventos
  it('E20: GET /api/v1/currais/{corralId}/eventos deve listar timeline de eventos', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchSuccess([])
    );
    await animalService.listEvents(12);
    const { url, options } = getFetchCallDetails(fetchSpy);
    expect(url).toMatch(/\/api\/v1\/currais\/12\/eventos$/);
    expect(options.method).toBe('GET');
  });

  // 21. Pendências: GET /currais/{corralId}/pendencias (direto e aninhado)
  it('E21: GET /api/v1/currais/{corralId}/pendencias deve listar pendências RFID', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchSuccess([])
    );
    await pendencyService.listPendencies(12);
    expect(getFetchCallDetails(fetchSpy).url).toMatch(/\/api\/v1\/currais\/12\/pendencias$/);

    await pendencyService.listPendencies(12, 5);
    expect(getFetchCallDetails(fetchSpy).url).toMatch(/\/api\/v1\/farms\/5\/currais\/12\/pendencias$/);
  });

  // 22. Pendências: POST / PUT /pendencias/{pendencyId}/resolver
  it('E22: POST e PUT /api/v1/pendencias/{pendencyId}/resolver deve suportar ambos os verbos', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchSuccess({ id: 8, resolved: true, animalIdResolved: 3 })
    );

    await pendencyService.resolvePendency(8, { animalId: 3 }, 'POST');
    expect(getFetchCallDetails(fetchSpy).url).toMatch(/\/api\/v1\/pendencias\/8\/resolver$/);
    expect(getFetchCallDetails(fetchSpy).options.method).toBe('POST');

    await pendencyService.resolvePendency(8, { animalId: 3 }, 'PUT');
    expect(getFetchCallDetails(fetchSpy).url).toMatch(/\/api\/v1\/pendencias\/8\/resolver$/);
    expect(getFetchCallDetails(fetchSpy).options.method).toBe('PUT');
  });

  // 23. Limpeza: POST /currais/{corralId}/limpeza
  it('E23: POST /api/v1/currais/{corralId}/limpeza deve acionar limpeza (com ou sem payload)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchSuccess({ id: 'uuid', state: 'CONCLUIDO' })
    );

    // Sem payload
    await cleanService.triggerCleaning(12);
    expect(getFetchCallDetails(fetchSpy).url).toMatch(/\/api\/v1\/currais\/12\/limpeza$/);
    expect(getFetchCallDetails(fetchSpy).options.method).toBe('POST');

    // Com payload
    await cleanService.triggerCleaning(12, { origin: 'MANUAL', secondsDuration: 25 });
    expect(getFetchCallDetails(fetchSpy).body).toEqual({ origin: 'MANUAL', secondsDuration: 25 });
  });

  // 24. Limpeza: GET /currais/{corralId}/limpezas
  it('E24: GET /api/v1/currais/{corralId}/limpezas deve listar histórico de limpezas', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchSuccess([])
    );
    await cleanService.listCleanHistory(12);
    const { url, options } = getFetchCallDetails(fetchSpy);
    expect(url).toMatch(/\/api\/v1\/currais\/12\/limpezas$/);
    expect(options.method).toBe('GET');
  });

  // 25. Odor: GET /currais/{corralId}/odor
  it('E25: GET /api/v1/currais/{corralId}/odor deve consultar leituras do sensor MQ-135', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchSuccess([])
    );
    await odorService.getOdorReadings(12);
    const { url, options } = getFetchCallDetails(fetchSpy);
    expect(url).toMatch(/\/api\/v1\/currais\/12\/odor$/);
    expect(options.method).toBe('GET');
  });
});

describe('Empirical Challenger 2: RFC 7807 Fail-Fast Locks & Boundary Testing', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('R1: deve capturar 409 Conflict da Trava Biológica (animal presente no curral)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchProblemDetail(
        {
          status: 409,
          title: 'Conflito de Regra de Negócio',
          detail: 'Tem uma vaca no curral neste momento, não tem como acionar a bomba de limpeza',
          instance: '/api/v1/currais/1/limpeza',
        },
        409
      )
    );

    try {
      await cleanService.triggerCleaning(1);
      expect.fail('Deveria falhar com 409');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.isConflict()).toBe(true);
      expect(apiErr.detail).toContain('Tem uma vaca no curral');
    }
  });

  it('R2: deve capturar 409 Conflict da Trava de Concorrência (bomba já em andamento)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchProblemDetail(
        {
          status: 409,
          title: 'Conflito de Regra de Negócio',
          detail: 'Existe um ciclo de limpeza em andamento para este curral',
          instance: '/api/v1/currais/1/limpeza',
        },
        409
      )
    );

    try {
      await cleanService.triggerCleaning(1);
      expect.fail('Deveria falhar com 409');
    } catch (err) {
      const apiErr = err as ApiError;
      expect(apiErr.isConflict()).toBe(true);
      expect(apiErr.detail).toContain('ciclo de limpeza em andamento');
    }
  });

  it('R3: deve capturar 409 Conflict da Trava de Conectividade (ESP32 offline)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchProblemDetail(
        {
          status: 409,
          title: 'Conflito de Regra de Negócio',
          detail: 'O dispositivo ESP32 do curral está OFFLINE',
          instance: '/api/v1/currais/1/limpeza',
        },
        409
      )
    );

    try {
      await cleanService.triggerCleaning(1);
      expect.fail('Deveria falhar com 409');
    } catch (err) {
      const apiErr = err as ApiError;
      expect(apiErr.isConflict()).toBe(true);
      expect(apiErr.detail).toContain('dispositivo ESP32 do curral está OFFLINE');
    }
  });

  it('R4: deve tratar resposta 400 com campos de validação múltiplos (invalidParams)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchProblemDetail(
        {
          status: 400,
          title: 'Erro de Validação',
          detail: 'Um ou mais campos são inválidos',
          invalidParams: {
            name: 'O nome da fazenda deve ter entre 2 e 100 caracteres',
            macAddress: 'O MAC Address deve conter exatamente 12 caracteres hexadecimais',
          },
        },
        400
      )
    );

    try {
      await corralService.createCorral(1, { name: '', macAddress: '240AC4000110' });
      expect.fail('Deveria falhar com 400');
    } catch (err) {
      const apiErr = err as ApiError;
      expect(apiErr.isValidationError()).toBe(true);
      expect(apiErr.getFieldError('name')).toContain('entre 2 e 100 caracteres');
      expect(apiErr.getFieldError('macAddress')).toContain('12 caracteres hexadecimais');
    }
  });

  it('R5: deve disparar callback de logout imediato em resposta 401 Unauthorized', async () => {
    const onUnauthorized = vi.fn();
    setOnUnauthorized(onUnauthorized);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchProblemDetail(
        {
          status: 401,
          title: 'Não Autorizado',
          detail: 'Token JWT expirado ou inválido',
        },
        401
      )
    );

    await expect(farmService.listFarms()).rejects.toThrow(ApiError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});

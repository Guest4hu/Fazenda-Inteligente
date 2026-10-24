/**
 * tests/services/liveBackendRoundtrip.test.ts
 * Empirical Challenger 2 - Live Backend Roundtrip Verification
 *
 * Runs end-to-end against the local Spring Boot backend (http://localhost:8080)
 * using the real production service implementations from src/services/*:
 * - authService
 * - farmService
 * - corralService (with MAC sanitization on the wire)
 * - animalService (with tag normalization on the wire)
 * - pendencyService
 * - cleanService (verifying RFC 7807 409 Conflict locks from the real backend)
 * - odorService
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  authService,
  farmService,
  corralService,
  animalService,
  pendencyService,
  cleanService,
  odorService,
  setToken,
  clearToken,
  ApiError,
} from '../../src/services';

const BACKEND_BASE = 'http://localhost:8080';

// Proxy fetch in test environment if endpoint is relative (/api/...)
const originalFetch = globalThis.fetch;
beforeAll(() => {
  globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    let url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
    if (url.startsWith('/api')) {
      url = `${BACKEND_BASE}${url}`;
    }
    return originalFetch(url, init);
  };
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});

// Check if backend is reachable
let backendAvailable = false;
try {
  const probe = await originalFetch(`${BACKEND_BASE}/api/v1/farms`);
  backendAvailable = probe.status === 403; // Expected 403 Forbidden without token
} catch {
  backendAvailable = false;
}

describe.runIf(backendAvailable)('Empirical Challenger 2: Live Backend Roundtrip via Services', () => {
  const runId = Date.now().toString().slice(-6);
  const userEmail = `challenger_${runId}@fazenda.com`;
  const userPassword = 'TestPassword123!';
  let createdFarmId: number;
  let createdCorralId: number;
  let createdAnimalId: number;
  const rawMacAddress = `24:0A:C4:00:${runId.slice(0, 2)}:${runId.slice(2, 4)}`;
  const expectedSanitizedMac = `240AC400${runId.slice(0, 4)}`.toUpperCase();
  const rawTagUid = `tag-${runId}`;
  const expectedNormalizedTag = `TAG-${runId}`;

  afterAll(async () => {
    // Teardown resources
    try {
      if (createdAnimalId) await animalService.deleteAnimal(createdAnimalId);
    } catch {}
    try {
      if (createdCorralId) await corralService.deleteCorral(createdCorralId);
    } catch {}
    try {
      if (createdFarmId) await farmService.deleteFarm(createdFarmId);
    } catch {}
    clearToken();
  });

  it('L1. Auth: deve registrar novo produtor e obter token JWT real', async () => {
    const registerRes = await authService.register({
      name: `Produtor Challenger ${runId}`,
      email: userEmail,
      password: userPassword,
    });

    expect(registerRes).toBeDefined();
    expect(registerRes.userId).toBeGreaterThan(0);
    expect(registerRes.email).toBe(userEmail);
    expect(registerRes.token).toBeDefined();
    expect(registerRes.token.split('.').length).toBe(3); // Valid 3-part JWT
  });

  it('L2. Auth: deve efetuar login com produtor cadastrado e persistir token', async () => {
    const loginRes = await authService.login({
      email: userEmail,
      password: userPassword,
    });

    expect(loginRes).toBeDefined();
    expect(loginRes.token).toBeDefined();
    expect(authService.getToken()).toBe(loginRes.token);
  });

  it('L3. Fazendas: deve criar fazenda via farmService.createFarm', async () => {
    const farm = await farmService.createFarm({
      name: `Fazenda Challenger ${runId}`,
    });

    expect(farm).toBeDefined();
    expect(farm.id).toBeGreaterThan(0);
    expect(farm.name).toBe(`Fazenda Challenger ${runId}`);
    createdFarmId = farm.id;
  });

  it('L4. Fazendas: deve listar fazendas e conter a fazenda criada', async () => {
    const farms = await farmService.listFarms();
    expect(Array.isArray(farms)).toBe(true);
    const found = farms.find((f) => f.id === createdFarmId);
    expect(found).toBeDefined();
    expect(found?.name).toBe(`Fazenda Challenger ${runId}`);
  });

  it('L5. Fazendas: deve atualizar nome da fazenda via farmService.updateFarm', async () => {
    const updated = await farmService.updateFarm(createdFarmId, {
      name: `Fazenda Challenger ${runId} Editada`,
    });
    expect(updated.name).toBe(`Fazenda Challenger ${runId} Editada`);
  });

  it('L6. Currais: deve criar curral com MAC Address contendo colons e normalizar na rota', async () => {
    // Pass raw MAC with colons: '24:0A:C4:00:XX:YY'
    const corral = await corralService.createCorral(createdFarmId, {
      name: `Curral Challenger ${runId}`,
      macAddress: rawMacAddress,
      cleanTime: '06:00:00',
      limitOdor: 420,
      pumpDurationSeconds: 25,
    });

    expect(corral).toBeDefined();
    expect(corral.id).toBeGreaterThan(0);
    expect(corral.farmId).toBe(createdFarmId);
    // Backend Spring Boot stores and returns the 12-char uppercase hex MAC
    expect(corral.macAddress).toBe(expectedSanitizedMac);
    expect(corral.deviceStatus).toBe('OFFLINE');
    createdCorralId = corral.id;
  });

  it('L7. Currais: deve buscar curral por ID nas rotas direta e aninhada', async () => {
    const direct = await corralService.getCorral(createdCorralId);
    expect(direct.id).toBe(createdCorralId);
    expect(direct.macAddress).toBe(expectedSanitizedMac);

    const nested = await corralService.getCorral(createdCorralId, createdFarmId);
    expect(nested.id).toBe(createdCorralId);
  });

  it('L8. Currais: deve atualizar parâmetros operacionais via corralService.updateParameters', async () => {
    const updated = await corralService.updateParameters(createdCorralId, {
      cleanTime: '07:30:00',
      limitOdor: 480,
      pumpDurationSeconds: 35,
    });

    expect(updated.cleanTime).toBe('07:30:00');
    expect(updated.limitOdor).toBe(480);
    expect(updated.pumpDurationSeconds).toBe(35);
  });

  it('L9. Currais: deve consultar métricas agregadas do dashboard', async () => {
    const metrics = await corralService.getMetrics(createdCorralId);
    expect(metrics).toBeDefined();
    expect(metrics.corralId).toBe(createdCorralId);
    expect(metrics.farmId).toBe(createdFarmId);
    expect(typeof metrics.totalAnimaisNoCurral).toBe('number');
    expect(typeof metrics.limpezasHojeTotal).toBe('number');
  });

  it('L10. Animais: deve cadastrar animal com tagUid em minúsculas e normalizar para maiúsculas', async () => {
    const animal = await animalService.createAnimal(createdFarmId, {
      name: `Vaca Challenger ${runId}`,
      identification: `BR-${runId}`,
      tagUid: `  ${rawTagUid}  `,
    });

    expect(animal).toBeDefined();
    expect(animal.id).toBeGreaterThan(0);
    expect(animal.tagUid).toBe(expectedNormalizedTag);
    expect(animal.currentCorralId).toBeNull();
    createdAnimalId = animal.id;
  });

  it('L11. Animais: deve listar animais da fazenda e buscar por ID', async () => {
    const list = await animalService.listAnimals(createdFarmId);
    expect(list.some((a) => a.id === createdAnimalId)).toBe(true);

    const direct = await animalService.getAnimal(createdAnimalId);
    expect(direct.id).toBe(createdAnimalId);

    const nested = await animalService.getAnimal(createdAnimalId, createdFarmId);
    expect(nested.id).toBe(createdAnimalId);
  });

  it('L12. Presença: deve registrar entrada ENTROU e saída SAIU do animal no curral', async () => {
    // 1. Entrada
    const entryEvent = await animalService.sendPresence(createdCorralId, {
      tagUid: expectedNormalizedTag,
      typeEvent: 'ENTROU',
    });
    expect(entryEvent).toBeDefined();
    expect(entryEvent.typeEvent).toBe('ENTROU');
    expect(entryEvent.corralId).toBe(createdCorralId);

    // Verifica que o animal agora consta dentro do curral
    const animalAfterEntry = await animalService.getAnimal(createdAnimalId);
    expect(animalAfterEntry.currentCorralId).toBe(createdCorralId);

    // Trava Biológica: Tentar acionar limpeza com animal no curral deve disparar ApiError com status 409
    try {
      await cleanService.triggerCleaning(createdCorralId, {
        origin: 'MANUAL',
        secondsDuration: 15,
      });
      expect.fail('Deveria ter falhado com 409 Conflito de Regra de Negócio (Trava Biológica)');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(409);
      expect(apiErr.isConflict()).toBe(true);
      expect(apiErr.problemDetail.title).toBe('Conflito de Regra de Negócio');
      expect(apiErr.problemDetail.detail.toLowerCase()).toContain('vaca no curral');
    }

    // 2. Histórico de eventos
    const events = await animalService.listEvents(createdCorralId);
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].typeEvent).toBe('ENTROU');

    // 3. Saída
    const exitEvent = await animalService.sendPresence(createdCorralId, {
      tagUid: expectedNormalizedTag,
      typeEvent: 'SAIU',
    });
    expect(exitEvent.typeEvent).toBe('SAIU');

    // Verifica que o animal não está mais no curral
    const animalAfterExit = await animalService.getAnimal(createdAnimalId);
    expect(animalAfterExit.currentCorralId).toBeNull();
  });

  it('L13. Pendências: deve consultar pendências abertas do curral', async () => {
    const pendencies = await pendencyService.listPendencies(createdCorralId);
    expect(Array.isArray(pendencies)).toBe(true);
  });

  it('L14. Limpeza: deve disparar trava de segurança RFC 7807 (409 Conflict) ao acionar bomba com ESP32 offline', async () => {
    try {
      await cleanService.triggerCleaning(createdCorralId, {
        origin: 'MANUAL',
        secondsDuration: 10,
      });
      expect.fail('Deveria ter falhado com 409 Conflict');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(409);
      expect(apiErr.isConflict()).toBe(true);
      expect(apiErr.problemDetail.title).toBe('Conflito de Regra de Negócio');
    }
  });

  it('L15. Limpeza: deve consultar histórico de limpezas do curral', async () => {
    const history = await cleanService.listCleanHistory(createdCorralId);
    expect(Array.isArray(history)).toBe(true);
  });

  it('L16. Odor: deve consultar telemetria de odor do curral (vazia para curral novo)', async () => {
    const readings = await odorService.getOdorReadings(createdCorralId);
    expect(Array.isArray(readings)).toBe(true);
  });

  it('L17. Teardown: deve excluir animal, curral e fazenda com sucesso', async () => {
    await animalService.deleteAnimal(createdAnimalId);
    const animals = await animalService.listAnimals(createdFarmId);
    expect(animals.some((a) => a.id === createdAnimalId)).toBe(false);

    await corralService.deleteCorral(createdCorralId);
    const corrals = await corralService.listCorrais(createdFarmId);
    expect(corrals.some((c) => c.id === createdCorralId)).toBe(false);

    await farmService.deleteFarm(createdFarmId);
    const farms = await farmService.listFarms();
    expect(farms.some((f) => f.id === createdFarmId)).toBe(false);
  });
});

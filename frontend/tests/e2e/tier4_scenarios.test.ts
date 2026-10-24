import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  apiRequest,
  createTestUser,
  randomEmail,
  randomMac,
  randomTagUid,
  uniqueId,
  AuthResponseDTO,
  FarmResponseDTO,
  CorralResponseDTO,
  CorralMetricsResponseDTO,
  AnimalResponseDTO,
  AnimalEventResponseDTO,
  CleanCmdResponseDTO,
  OdorTelemetryResponseDTO,
} from './test_helper';

describe('Tier 4: Real-World Scenarios (End-to-End Farm Management Workflows)', () => {
  // Scenario 1 State
  let token: string;
  let farmId: number;
  let corral1Id: number;
  let corral2Id: number;
  let cow1: AnimalResponseDTO;
  let cow2: AnimalResponseDTO;
  let cow3: AnimalResponseDTO;

  // --------------------------------------------------------------------------
  // Scenario 1: Setup Farm -> Add Corral -> Configure Parameters
  // --------------------------------------------------------------------------
  it('Cenário 1: Onboarding de Produtor e Criação Completa da Infraestrutura da Fazenda', async () => {
    // 1. Registro de novo produtor rural
    const email = randomEmail();
    const password = 'Password@2026';
    const regRes = await apiRequest<AuthResponseDTO>('/auth/register', {
      method: 'POST',
      body: {
        name: 'Carlos Fazendeiro',
        email,
        password,
      },
    });
    assert.equal(regRes.status, 201, 'Produtor deve ser registrado com sucesso');
    token = regRes.data!.token;

    // 2. Login para validação de sessão
    const loginRes = await apiRequest<AuthResponseDTO>('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    assert.equal(loginRes.status, 200, 'Login deve emitir token válido');

    // 3. Cadastrar Fazenda
    const farmName = `Fazenda Bela Vista ${uniqueId()}`;
    const farmRes = await apiRequest<FarmResponseDTO>('/farms', {
      method: 'POST',
      token,
      body: { name: farmName },
    });
    assert.equal(farmRes.status, 201);
    farmId = farmRes.data!.id;

    // 4. Cadastrar 2 Currais com endereços MAC distintos de hardware
    const mac1 = randomMac();
    const mac2 = randomMac();

    const c1Res = await apiRequest<CorralResponseDTO>(`/farms/${farmId}/currais`, {
      method: 'POST',
      token,
      body: {
        name: 'Curral de Ordenha',
        macAddress: mac1,
        cleanTime: '05:30:00',
        limitOdor: 350,
        pumpDurationSeconds: 25,
      },
    });
    assert.equal(c1Res.status, 201);
    corral1Id = c1Res.data!.id;

    const c2Res = await apiRequest<CorralResponseDTO>(`/farms/${farmId}/currais`, {
      method: 'POST',
      token,
      body: {
        name: 'Curral de Descanso',
        macAddress: mac2,
        cleanTime: '18:00:00',
        limitOdor: 400,
        pumpDurationSeconds: 30,
      },
    });
    assert.equal(c2Res.status, 201);
    corral2Id = c2Res.data!.id;

    // 5. Ajustar parâmetros do Curral 1 via tela de configurações
    const paramRes = await apiRequest<CorralResponseDTO>(`/currais/${corral1Id}/parametros`, {
      method: 'PUT',
      token,
      body: {
        cleanTime: '06:00:00',
        limitOdor: 380,
        pumpDurationSeconds: 20,
      },
    });
    assert.equal(paramRes.status, 200);
    assert.equal(paramRes.data?.cleanTime, '06:00:00');
    assert.equal(paramRes.data?.limitOdor, 380);
    assert.equal(paramRes.data?.pumpDurationSeconds, 20);

    // 6. Consultar métricas do dashboard do Curral 1
    const metricsRes = await apiRequest<CorralMetricsResponseDTO>(`/currais/${corral1Id}/metricas`, {
      token,
    });
    assert.equal(metricsRes.status, 200);
    assert.equal(metricsRes.data?.totalAnimaisNoCurral, 0);
    assert.equal(metricsRes.data?.totalAnimaisNaFazenda, 0);
    assert.equal(metricsRes.data?.pendenciasAbertas, 0);

    // 7. Renomear fazenda
    const updatedFarmName = `${farmName} - Setor Leiteiro`;
    const updateFarmRes = await apiRequest<FarmResponseDTO>(`/farms/${farmId}`, {
      method: 'PUT',
      token,
      body: { name: updatedFarmName },
    });
    assert.equal(updateFarmRes.status, 200);
    assert.equal(updateFarmRes.data?.name, updatedFarmName);
  });

  // --------------------------------------------------------------------------
  // Scenario 2: Register Animals -> Toggle Presence -> Events Timeline
  // --------------------------------------------------------------------------
  it('Cenário 2: Manejo do Rebanho, Presença RFID e Histórico Cronológico', async () => {
    // 1. Cadastrar 3 animais
    const tag1 = randomTagUid();
    const tag2 = randomTagUid();
    const tag3 = randomTagUid();

    const a1Res = await apiRequest<AnimalResponseDTO>(`/farms/${farmId}/animais`, {
      method: 'POST',
      token,
      body: { name: 'Vaca Estrela', identification: 'BR-BV-01', tagUid: tag1 },
    });
    assert.equal(a1Res.status, 201);
    cow1 = a1Res.data!;

    const a2Res = await apiRequest<AnimalResponseDTO>(`/farms/${farmId}/animais`, {
      method: 'POST',
      token,
      body: { name: 'Vaca Mimosa', identification: 'BR-BV-02', tagUid: tag2 },
    });
    assert.equal(a2Res.status, 201);
    cow2 = a2Res.data!;

    const a3Res = await apiRequest<AnimalResponseDTO>(`/farms/${farmId}/animais`, {
      method: 'POST',
      token,
      body: { name: 'Novilha Mocho', identification: 'BR-BV-03', tagUid: tag3 },
    });
    assert.equal(a3Res.status, 201);
    cow3 = a3Res.data!;

    // 2. Verificar que todos os 3 animais constam na fazenda e estão fora do curral (pasto)
    const listAnimals = await apiRequest<AnimalResponseDTO[]>(`/farms/${farmId}/animais`, { token });
    assert.equal(listAnimals.status, 200);
    assert.equal(listAnimals.data?.length, 3);
    assert.ok(listAnimals.data?.every((a) => a.currentCorralId === null));

    // 3. Manejo Matinal: Vaca 1 e Vaca 2 entram no Curral 1 (Ordenha) via sensor RFID
    const enter1 = await apiRequest<AnimalEventResponseDTO>(`/currais/${corral1Id}/presenca`, {
      method: 'POST',
      token,
      body: { tagUid: cow1.tagUid, typeEvent: 'ENTROU', origin: 'TAG' },
    });
    assert.equal(enter1.status, 201);
    assert.equal(enter1.data?.eventOrigin, 'TAG');

    const enter2 = await apiRequest<AnimalEventResponseDTO>(`/currais/${corral1Id}/presenca`, {
      method: 'POST',
      token,
      body: { tagUid: cow2.tagUid, typeEvent: 'ENTROU', origin: 'TAG' },
    });
    assert.equal(enter2.status, 201);

    // 4. Vaca 3 entra no Curral 2 (Descanso) manualmente pelo produtor
    const enter3 = await apiRequest<AnimalEventResponseDTO>(`/currais/${corral2Id}/presenca`, {
      method: 'POST',
      token,
      body: { tagUid: cow3.tagUid, typeEvent: 'ENTROU', origin: 'MANUAL' },
    });
    assert.equal(enter3.status, 201);
    assert.equal(enter3.data?.eventOrigin, 'MANUAL');

    // 5. Verificar métricas dos dois currais de forma isolada
    const mCurral1 = await apiRequest<CorralMetricsResponseDTO>(`/currais/${corral1Id}/metricas`, { token });
    assert.equal(mCurral1.data?.totalAnimaisNoCurral, 2, 'Curral 1 deve ter 2 animais');
    assert.equal(mCurral1.data?.totalAnimaisNaFazenda, 3);

    const mCurral2 = await apiRequest<CorralMetricsResponseDTO>(`/currais/${corral2Id}/metricas`, { token });
    assert.equal(mCurral2.data?.totalAnimaisNoCurral, 1, 'Curral 2 deve ter 1 animal');

    // 6. Fim da ordenha: Vaca 1 sai do Curral 1
    const exit1 = await apiRequest<AnimalEventResponseDTO>(`/currais/${corral1Id}/presenca`, {
      method: 'POST',
      token,
      body: { tagUid: cow1.tagUid, typeEvent: 'SAIU', origin: 'TAG' },
    });
    assert.equal(exit1.status, 201);

    // 7. Consultar linha do tempo de eventos do Curral 1
    const timeline = await apiRequest<AnimalEventResponseDTO[]>(`/currais/${corral1Id}/eventos`, { token });
    assert.equal(timeline.status, 200);
    assert.ok(timeline.data && timeline.data.length >= 3);
    // Mais recente é a saída da Vaca 1
    assert.equal(timeline.data![0].typeEvent, 'SAIU');
    assert.equal(timeline.data![0].animalId, cow1.id);

    // 8. Métricas atualizadas no Curral 1: 1 animal restante
    const mCurral1Updated = await apiRequest<CorralMetricsResponseDTO>(`/currais/${corral1Id}/metricas`, { token });
    assert.equal(mCurral1Updated.data?.totalAnimaisNoCurral, 1);
  });

  // --------------------------------------------------------------------------
  // Scenario 3: Monitor Odor -> Fail-Fast Biological Safety -> Cleaning History
  // --------------------------------------------------------------------------
  it('Cenário 3: Monitoramento de Telemetria e Ciclo de Segurança da Limpeza', async () => {
    // 1. Consulta telemetria de odor do sensor MQ-135 do Curral 1
    const odorRes = await apiRequest<OdorTelemetryResponseDTO[]>(`/currais/${corral1Id}/odor`, { token });
    assert.equal(odorRes.status, 200);
    assert.ok(Array.isArray(odorRes.data));

    // 2. Vaca 2 ainda está no Curral 1 -> Tentativa de acionar bomba de limpeza DEVE FALHAR (Trava Biológica)
    const failClean = await apiRequest(`/currais/${corral1Id}/limpeza`, {
      method: 'POST',
      token,
      body: { origin: 'MANUAL', secondsDuration: 15 },
    });
    assert.equal(failClean.status, 409, 'Bomba não pode ligar com animal no curral');
    assert.ok(
      failClean.error?.detail?.includes('vaca no curral'),
      `Mensagem esperada sobre animal no curral, recebido: ${failClean.error?.detail}`
    );

    // 3. Produtor evacua a Vaca 2 do Curral 1
    await apiRequest(`/currais/${corral1Id}/presenca`, {
      method: 'POST',
      token,
      body: { tagUid: cow2.tagUid, typeEvent: 'SAIU' },
    });

    // 4. Confirma que Curral 1 agora está totalmente vazio
    const mEmpty = await apiRequest<CorralMetricsResponseDTO>(`/currais/${corral1Id}/metricas`, { token });
    assert.equal(mEmpty.data?.totalAnimaisNoCurral, 0);

    // 5. Tenta acionar a limpeza novamente -> Trava biológica superada!
    // Cai na trava de conectividade (ESP32 em bancada de desenvolvimento offline)
    const cleanAttempt = await apiRequest(`/currais/${corral1Id}/limpeza`, {
      method: 'POST',
      token,
      body: { origin: 'MANUAL', secondsDuration: 20 },
    });
    assert.equal(cleanAttempt.status, 409);
    assert.ok(
      !cleanAttempt.error?.detail?.includes('vaca no curral'),
      'Trava biológica deve estar liberada após evacuação'
    );
    assert.ok(
      cleanAttempt.error?.detail?.includes('offline') || cleanAttempt.error?.detail?.includes('comunicação')
    );

    // 6. Consulta histórico de limpezas
    const historyRes = await apiRequest<CleanCmdResponseDTO[]>(`/currais/${corral1Id}/limpezas`, { token });
    assert.equal(historyRes.status, 200);
    assert.ok(Array.isArray(historyRes.data));
  });

  // --------------------------------------------------------------------------
  // Scenario 4: RFID Unknown Tag Pendency Resolution Workflow
  // --------------------------------------------------------------------------
  it('Cenário 4: Consulta e Resolução de Pendências RFID de Tags Desconhecidas', async () => {
    // 1. Listar pendências abertas do Curral 1
    const pendRes = await apiRequest(`/currais/${corral1Id}/pendencias`, { token });
    assert.equal(pendRes.status, 200);
    assert.ok(Array.isArray(pendRes.data));

    // 2. Valida resolução de pendência com animalId inexistente -> 404
    const resUnknown = await apiRequest('/pendencias/9999999/resolver', {
      method: 'POST',
      token,
      body: { animalId: cow1.id },
    });
    assert.equal(resUnknown.status, 404);

    // 3. Valida resolução com payload inválido -> 400 invalidParams
    const resInvalid = await apiRequest('/pendencias/9999999/resolver', {
      method: 'POST',
      token,
      body: {},
    });
    assert.equal(resInvalid.status, 400);
  });

  // --------------------------------------------------------------------------
  // Scenario 5: Teardown & Limpeza Completa de Recursos da Fazenda
  // --------------------------------------------------------------------------
  it('Cenário 5: Teardown Seguro e Verificação de Integridade Referencial', async () => {
    // 1. Remove os 3 animais
    const d1 = await apiRequest(`/animais/${cow1.id}`, { method: 'DELETE', token });
    assert.equal(d1.status, 204);

    const d2 = await apiRequest(`/animais/${cow2.id}`, { method: 'DELETE', token });
    assert.equal(d2.status, 204);

    const d3 = await apiRequest(`/animais/${cow3.id}`, { method: 'DELETE', token });
    assert.equal(d3.status, 204);

    // 2. Remove os 2 currais
    const dc1 = await apiRequest(`/currais/${corral1Id}`, { method: 'DELETE', token });
    assert.equal(dc1.status, 204);

    const dc2 = await apiRequest(`/currais/${corral2Id}`, { method: 'DELETE', token });
    assert.equal(dc2.status, 204);

    // 3. Remove a fazenda
    const df = await apiRequest(`/farms/${farmId}`, { method: 'DELETE', token });
    assert.equal(df.status, 204);

    // 4. Confirma que o produtor tem zero fazendas restantes
    const listFarms = await apiRequest<FarmResponseDTO[]>('/farms', { token });
    assert.equal(listFarms.status, 200);
    assert.equal(listFarms.data?.length, 0, 'Todas as fazendas do usuário foram limpas');
  });
});

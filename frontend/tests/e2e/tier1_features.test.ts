import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  apiRequest,
  createTestUser,
  createTestFarm,
  createTestCorral,
  createTestAnimal,
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
  IdentifyPendencyResponseDTO,
  CleanCmdResponseDTO,
  OdorTelemetryResponseDTO,
} from './test_helper';

describe('Tier 1: Feature Coverage (Happy Paths across all 7 modules & 24 endpoints)', () => {
  // Shared state for Tier 1 tests
  let userToken: string;
  let userId: number;
  let farmId: number;
  let corralId: number;
  let corralMac: string;
  let animalId: number;
  let animalTag: string;

  // --------------------------------------------------------------------------
  // Module 1: Auth (AuthController)
  // --------------------------------------------------------------------------
  describe('Module 1: Autenticação (AuthController)', () => {
    it('1.1: POST /auth/register - deve cadastrar novo produtor rural e retornar token JWT', async () => {
      const email = randomEmail();
      const res = await apiRequest<AuthResponseDTO>('/auth/register', {
        method: 'POST',
        body: {
          name: 'Produtor Tier1',
          email,
          password: 'Password@123',
        },
      });

      assert.equal(res.status, 201, `Esperado 201, recebido ${res.status}`);
      assert.ok(res.data?.token, 'Token JWT deve estar presente');
      assert.ok(res.data?.userId, 'userId deve estar presente');
      assert.equal(res.data?.email, email);
      assert.equal(res.data?.name, 'Produtor Tier1');

      userToken = res.data.token;
      userId = res.data.userId;
    });

    it('1.2: POST /auth/login - deve realizar login com sucesso e emitir novo token JWT', async () => {
      const email = randomEmail();
      const password = 'Password@123';
      await apiRequest('/auth/register', {
        method: 'POST',
        body: { name: 'Produtor Login', email, password },
      });

      const res = await apiRequest<AuthResponseDTO>('/auth/login', {
        method: 'POST',
        body: { email, password },
      });

      assert.equal(res.status, 200, `Esperado 200, recebido ${res.status}`);
      assert.ok(res.data?.token, 'Token JWT deve ser retornado no login');
      assert.equal(res.data?.email, email);
    });

    it('1.3: POST /auth/register - deve aceitar nome com tamanho mínimo permitido (3 caracteres)', async () => {
      const res = await apiRequest<AuthResponseDTO>('/auth/register', {
        method: 'POST',
        body: {
          name: 'Ana',
          email: randomEmail(),
          password: 'Password@123',
        },
      });
      assert.equal(res.status, 201);
      assert.equal(res.data?.name, 'Ana');
    });

    it('1.4: POST /auth/register - deve aceitar nome com tamanho máximo (100 caracteres)', async () => {
      const longName = 'Produtor '.padEnd(100, 'X');
      const res = await apiRequest<AuthResponseDTO>('/auth/register', {
        method: 'POST',
        body: {
          name: longName,
          email: randomEmail(),
          password: 'Password@123',
        },
      });
      assert.equal(res.status, 201);
      assert.equal(res.data?.name, longName);
    });

    it('1.5: POST /auth/login - token retornado deve possuir estrutura válida de 3 partes JWT', async () => {
      const email = randomEmail();
      const password = 'Password@123';
      const reg = await apiRequest<AuthResponseDTO>('/auth/register', {
        method: 'POST',
        body: { name: 'Token Structure Test', email, password },
      });

      const parts = reg.data!.token.split('.');
      assert.equal(parts.length, 3, 'JWT deve conter 3 partes separadas por ponto');
    });
  });

  // --------------------------------------------------------------------------
  // Module 2: Farms (FarmController)
  // --------------------------------------------------------------------------
  describe('Module 2: Fazendas (FarmController)', () => {
    it('2.1: POST /farms - deve cadastrar nova fazenda com sucesso', async () => {
      const farmName = `Fazenda Tier1 ${uniqueId()}`;
      const res = await apiRequest<FarmResponseDTO>('/farms', {
        method: 'POST',
        token: userToken,
        body: { name: farmName },
      });

      assert.equal(res.status, 201);
      assert.ok(res.data?.id, 'ID da fazenda deve ser gerado');
      assert.equal(res.data?.name, farmName);
      assert.ok(res.data?.createdAt, 'Data de criação deve estar preenchida');

      farmId = res.data.id;
    });

    it('2.2: GET /farms - deve listar fazendas pertencentes ao usuário logado', async () => {
      const res = await apiRequest<FarmResponseDTO[]>('/farms', {
        token: userToken,
      });

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.data), 'Resposta deve ser um array');
      const found = res.data?.some((f) => f.id === farmId);
      assert.ok(found, 'Fazenda criada deve constar na listagem');
    });

    it('2.3: PUT /farms/{farmId} - deve atualizar nome da fazenda', async () => {
      const newName = `Fazenda Renomeada ${uniqueId()}`;
      const res = await apiRequest<FarmResponseDTO>(`/farms/${farmId}`, {
        method: 'PUT',
        token: userToken,
        body: { name: newName },
      });

      assert.equal(res.status, 200);
      assert.equal(res.data?.id, farmId);
      assert.equal(res.data?.name, newName);
    });

    it('2.4: GET /farms - deve refletir o nome atualizado da fazenda', async () => {
      const res = await apiRequest<FarmResponseDTO[]>('/farms', {
        token: userToken,
      });

      assert.equal(res.status, 200);
      const farm = res.data?.find((f) => f.id === farmId);
      assert.ok(farm?.name.startsWith('Fazenda Renomeada'), 'Nome atualizado deve persistir');
    });

    it('2.5: DELETE /farms/{farmId} - deve excluir fazenda vazia sem erros (204 No Content)', async () => {
      // Cria fazenda descartável
      const tempFarm = await createTestFarm(userToken);
      const res = await apiRequest(`/farms/${tempFarm.id}`, {
        method: 'DELETE',
        token: userToken,
      });

      assert.equal(res.status, 204, 'Exclusão com sucesso deve retornar 204 No Content');

      // Verifica se realmente sumiu da listagem
      const listRes = await apiRequest<FarmResponseDTO[]>('/farms', {
        token: userToken,
      });
      const stillExists = listRes.data?.some((f) => f.id === tempFarm.id);
      assert.equal(stillExists, false, 'Fazenda excluída não deve mais constar na lista');
    });
  });

  // --------------------------------------------------------------------------
  // Module 3: Corrais, Parâmetros e Métricas (CorralController)
  // --------------------------------------------------------------------------
  describe('Module 3: Currais, Parâmetros e Métricas (CorralController)', () => {
    it('3.1: POST /farms/{farmId}/currais - deve cadastrar curral com parâmetros operacionais', async () => {
      corralMac = randomMac();
      const res = await apiRequest<CorralResponseDTO>(`/farms/${farmId}/currais`, {
        method: 'POST',
        token: userToken,
        body: {
          name: 'Curral Principal T1',
          macAddress: corralMac,
          cleanTime: '06:30:00',
          limitOdor: 420,
          pumpDurationSeconds: 25,
        },
      });

      assert.equal(res.status, 201);
      assert.ok(res.data?.id, 'ID do curral deve ser gerado');
      assert.equal(res.data?.farmId, farmId);
      assert.equal(res.data?.name, 'Curral Principal T1');
      assert.equal(res.data?.macAddress, corralMac);
      assert.equal(res.data?.cleanTime, '06:30:00');
      assert.equal(res.data?.limitOdor, 420);
      assert.equal(res.data?.pumpDurationSeconds, 25);
      assert.equal(res.data?.deviceStatus, 'OFFLINE');

      corralId = res.data.id;
    });

    it('3.2: GET /farms/{farmId}/currais - deve listar currais da fazenda', async () => {
      const res = await apiRequest<CorralResponseDTO[]>(`/farms/${farmId}/currais`, {
        token: userToken,
      });

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.data));
      const found = res.data?.some((c) => c.id === corralId);
      assert.ok(found, 'Curral criado deve estar presente na lista da fazenda');
    });

    it('3.3: GET /currais/{corralId} - deve buscar curral por ID via rota direta', async () => {
      const res = await apiRequest<CorralResponseDTO>(`/currais/${corralId}`, {
        token: userToken,
      });

      assert.equal(res.status, 200);
      assert.equal(res.data?.id, corralId);
      assert.equal(res.data?.macAddress, corralMac);
    });

    it('3.4: GET /farms/{farmId}/currais/{corralId} - deve buscar curral via rota aninhada', async () => {
      const res = await apiRequest<CorralResponseDTO>(`/farms/${farmId}/currais/${corralId}`, {
        token: userToken,
      });

      assert.equal(res.status, 200);
      assert.equal(res.data?.id, corralId);
      assert.equal(res.data?.farmId, farmId);
    });

    it('3.5: PUT /currais/{corralId} - deve atualizar dados completos do curral', async () => {
      const res = await apiRequest<CorralResponseDTO>(`/currais/${corralId}`, {
        method: 'PUT',
        token: userToken,
        body: {
          name: 'Curral Principal Editado',
          macAddress: corralMac,
          cleanTime: '07:15:00',
          limitOdor: 450,
          pumpDurationSeconds: 35,
        },
      });

      assert.equal(res.status, 200);
      assert.equal(res.data?.name, 'Curral Principal Editado');
      assert.equal(res.data?.cleanTime, '07:15:00');
      assert.equal(res.data?.limitOdor, 450);
      assert.equal(res.data?.pumpDurationSeconds, 35);
    });

    it('3.6: PUT /currais/{corralId}/parametros - deve atualizar apenas parâmetros operacionais', async () => {
      const res = await apiRequest<CorralResponseDTO>(`/currais/${corralId}/parametros`, {
        method: 'PUT',
        token: userToken,
        body: {
          cleanTime: '08:00:00',
          limitOdor: 390,
          pumpDurationSeconds: 20,
        },
      });

      assert.equal(res.status, 200);
      assert.equal(res.data?.cleanTime, '08:00:00');
      assert.equal(res.data?.limitOdor, 390);
      assert.equal(res.data?.pumpDurationSeconds, 20);
      assert.equal(res.data?.name, 'Curral Principal Editado', 'Nome deve ser preservado');
    });

    it('3.7: PUT /currais/{corralId}/parametros - deve desativar horário automático quando cleanTime for null', async () => {
      const res = await apiRequest<CorralResponseDTO>(`/currais/${corralId}/parametros`, {
        method: 'PUT',
        token: userToken,
        body: {
          cleanTime: null,
        },
      });

      assert.equal(res.status, 200);
      assert.equal(res.data?.cleanTime, null, 'cleanTime deve ser nulo');
    });

    it('3.8: GET /currais/{corralId}/metricas - deve retornar contadores e métricas do dashboard', async () => {
      const res = await apiRequest<CorralMetricsResponseDTO>(`/currais/${corralId}/metricas`, {
        token: userToken,
      });

      assert.equal(res.status, 200);
      assert.equal(res.data?.corralId, corralId);
      assert.equal(res.data?.farmId, farmId);
      assert.ok(typeof res.data?.totalAnimaisNoCurral === 'number');
      assert.ok(typeof res.data?.totalAnimaisNaFazenda === 'number');
      assert.ok(typeof res.data?.limpezasHojeTotal === 'number');
      assert.ok(typeof res.data?.pendenciasAbertas === 'number');
      assert.ok(res.data?.deviceStatus === 'ONLINE' || res.data?.deviceStatus === 'OFFLINE');
    });

    it('3.9: DELETE /currais/{corralId} - deve remover curral vazio (204 No Content)', async () => {
      const tempCorral = await createTestCorral(userToken, farmId);
      const res = await apiRequest(`/currais/${tempCorral.id}`, {
        method: 'DELETE',
        token: userToken,
      });

      assert.equal(res.status, 204);

      // Confirma que não existe mais
      const getRes = await apiRequest(`/currais/${tempCorral.id}`, {
        token: userToken,
      });
      assert.equal(getRes.status, 404);
    });
  });

  // --------------------------------------------------------------------------
  // Module 4: Animais e Presença RFID (AnimalController)
  // --------------------------------------------------------------------------
  describe('Module 4: Animais e Presença RFID (AnimalController)', () => {
    it('4.1: POST /farms/{farmId}/animais - deve cadastrar animal na fazenda vinculando Tag RFID', async () => {
      animalTag = randomTagUid();
      const res = await apiRequest<AnimalResponseDTO>(`/farms/${farmId}/animais`, {
        method: 'POST',
        token: userToken,
        body: {
          name: 'Vaca Mimosa T1',
          identification: 'BR-T1-01',
          tagUid: animalTag,
        },
      });

      assert.equal(res.status, 201);
      assert.ok(res.data?.id);
      assert.equal(res.data?.farmId, farmId);
      assert.equal(res.data?.name, 'Vaca Mimosa T1');
      assert.equal(res.data?.tagUid, animalTag.toUpperCase());
      assert.equal(res.data?.currentCorralId, null);

      animalId = res.data.id;
    });

    it('4.2: GET /farms/{farmId}/animais - deve listar animais cadastrados na fazenda', async () => {
      const res = await apiRequest<AnimalResponseDTO[]>(`/farms/${farmId}/animais`, {
        token: userToken,
      });

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.data));
      const found = res.data?.some((a) => a.id === animalId);
      assert.ok(found, 'Animal cadastrado deve estar na listagem da fazenda');
    });

    it('4.3: GET /animais/{animalId} - deve buscar animal por ID', async () => {
      const res = await apiRequest<AnimalResponseDTO>(`/animais/${animalId}`, {
        token: userToken,
      });

      assert.equal(res.status, 200);
      assert.equal(res.data?.id, animalId);
      assert.equal(res.data?.name, 'Vaca Mimosa T1');
    });

    it('4.4: GET /farms/{farmId}/animais/{animalId} - deve buscar animal via rota aninhada', async () => {
      const res = await apiRequest<AnimalResponseDTO>(`/farms/${farmId}/animais/${animalId}`, {
        token: userToken,
      });

      assert.equal(res.status, 200);
      assert.equal(res.data?.id, animalId);
      assert.equal(res.data?.farmId, farmId);
    });

    it('4.5: PUT /animais/{animalId} - deve atualizar dados do animal', async () => {
      const res = await apiRequest<AnimalResponseDTO>(`/animais/${animalId}`, {
        method: 'PUT',
        token: userToken,
        body: {
          name: 'Vaca Mimosa Atualizada',
          identification: 'BR-T1-99',
          tagUid: animalTag,
        },
      });

      assert.equal(res.status, 200);
      assert.equal(res.data?.name, 'Vaca Mimosa Atualizada');
      assert.equal(res.data?.identification, 'BR-T1-99');
    });

    it('4.6: POST /currais/{corralId}/presenca - deve registrar entrada manual de animal no curral (ENTROU)', async () => {
      const res = await apiRequest<AnimalEventResponseDTO>(`/currais/${corralId}/presenca`, {
        method: 'POST',
        token: userToken,
        body: {
          tagUid: animalTag,
          typeEvent: 'ENTROU',
          origin: 'MANUAL',
        },
      });

      assert.equal(res.status, 201);
      assert.equal(res.data?.corralId, corralId);
      assert.equal(res.data?.animalId, animalId);
      assert.equal(res.data?.typeEvent, 'ENTROU');
      assert.equal(res.data?.eventOrigin, 'MANUAL');
      assert.ok(res.data?.instant);
    });

    it('4.7: GET /farms/{farmId}/animais - deve refletir que o animal está atualmente no curral', async () => {
      const res = await apiRequest<AnimalResponseDTO[]>(`/farms/${farmId}/animais`, {
        token: userToken,
      });

      assert.equal(res.status, 200);
      const animal = res.data?.find((a) => a.id === animalId);
      assert.equal(animal?.currentCorralId, corralId, 'currentCorralId deve apontar para o curral');
    });

    it('4.8: POST /currais/{corralId}/presenca - deve registrar saída de animal do curral (SAIU)', async () => {
      const res = await apiRequest<AnimalEventResponseDTO>(`/currais/${corralId}/presenca`, {
        method: 'POST',
        token: userToken,
        body: {
          tagUid: animalTag,
          typeEvent: 'SAIU',
          origin: 'TAG',
        },
      });

      assert.equal(res.status, 201);
      assert.equal(res.data?.typeEvent, 'SAIU');
      assert.equal(res.data?.eventOrigin, 'TAG');
    });

    it('4.9: GET /currais/{corralId}/eventos - deve retornar histórico cronológico de presenças', async () => {
      const res = await apiRequest<AnimalEventResponseDTO[]>(`/currais/${corralId}/eventos`, {
        token: userToken,
      });

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.data));
      assert.ok(res.data!.length >= 2, 'Histórico deve conter no mínimo os 2 eventos registrados');
      assert.equal(res.data![0].typeEvent, 'SAIU', 'Evento mais recente deve ser SAIU');
      assert.equal(res.data![1].typeEvent, 'ENTROU', 'Evento anterior deve ser ENTROU');
    });

    it('4.10: DELETE /animais/{animalId} - deve excluir animal com segurança (204 No Content)', async () => {
      const tempAnimal = await createTestAnimal(userToken, farmId);
      const res = await apiRequest(`/animais/${tempAnimal.id}`, {
        method: 'DELETE',
        token: userToken,
      });

      assert.equal(res.status, 204);

      const check = await apiRequest(`/animais/${tempAnimal.id}`, {
        token: userToken,
      });
      assert.equal(check.status, 404);
    });
  });

  // --------------------------------------------------------------------------
  // Module 5: Pendências RFID (PendencyController)
  // --------------------------------------------------------------------------
  describe('Module 5: Pendências RFID (PendencyController)', () => {
    it('5.1: GET /currais/{corralId}/pendencias - deve retornar 200 com array de pendências abertas', async () => {
      const res = await apiRequest<IdentifyPendencyResponseDTO[]>(`/currais/${corralId}/pendencias`, {
        token: userToken,
      });

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.data), 'Resposta deve ser uma lista (vazia ou com itens)');
    });

    it('5.2: GET /farms/{farmId}/currais/{corralId}/pendencias - rota aninhada deve retornar 200', async () => {
      const res = await apiRequest<IdentifyPendencyResponseDTO[]>(
        `/farms/${farmId}/currais/${corralId}/pendencias`,
        { token: userToken }
      );

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.data));
    });

    it('5.3: GET /currais/{corralId}/pendencias - estrutura das pendências deve conter os campos da especificação', async () => {
      const res = await apiRequest<IdentifyPendencyResponseDTO[]>(`/currais/${corralId}/pendencias`, {
        token: userToken,
      });
      assert.equal(res.status, 200);
      if (res.data && res.data.length > 0) {
        const item = res.data[0];
        assert.ok('id' in item);
        assert.ok('corralId' in item);
        assert.ok('tagUid' in item);
        assert.ok('resolved' in item);
      }
    });

    it('5.4: POST /pendencias/{pendencyId}/resolver - deve aceitar método POST para resolução de pendência', async () => {
      // Se não houver pendência real, valida o retorno 404 de pendência inexistente confirmando que a rota existe e responde
      const res = await apiRequest('/pendencias/9999999/resolver', {
        method: 'POST',
        token: userToken,
        body: { animalId },
      });
      assert.equal(res.status, 404, 'Rota POST de resolução de pendência deve responder adequadamente');
    });

    it('5.5: PUT /pendencias/{pendencyId}/resolver - deve aceitar método PUT para resolução de pendência', async () => {
      const res = await apiRequest('/pendencias/9999999/resolver', {
        method: 'PUT',
        token: userToken,
        body: { animalId },
      });
      assert.equal(res.status, 404, 'Rota PUT de resolução de pendência deve responder adequadamente');
    });
  });

  // --------------------------------------------------------------------------
  // Module 6: Limpeza e Histórico (CleanController)
  // --------------------------------------------------------------------------
  describe('Module 6: Limpeza e Histórico (CleanController)', () => {
    it('6.1: GET /currais/{corralId}/limpezas - deve listar histórico de limpezas do curral', async () => {
      const res = await apiRequest<CleanCmdResponseDTO[]>(`/currais/${corralId}/limpezas`, {
        token: userToken,
      });

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.data), 'Resposta deve ser um array');
    });

    it('6.2: GET /currais/{corralId}/limpeza - rota singular deve funcionar como alias da listagem', async () => {
      const res = await apiRequest<CleanCmdResponseDTO[]>(`/currais/${corralId}/limpeza`, {
        token: userToken,
      });

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.data));
    });

    it('6.3: POST /currais/{corralId}/limpeza - deve validar trava de conectividade quando ESP32 estiver offline (409)', async () => {
      const res = await apiRequest(`/currais/${corralId}/limpeza`, {
        method: 'POST',
        token: userToken,
        body: {
          origin: 'MANUAL',
          secondsDuration: 15,
        },
      });

      // ESP32 novo começa OFFLINE -> trava de conectividade deve disparar 409 Conflict
      assert.equal(res.status, 409, 'Curral offline deve disparar trava fail-fast 409');
      assert.ok(res.error?.detail?.includes('offline') || res.error?.detail?.includes('comunicação'));
    });

    it('6.4: POST /currais/{corralId}/limpeza - payload sem corpo JSON deve ser aceito pela especificação', async () => {
      const res = await apiRequest(`/currais/${corralId}/limpeza`, {
        method: 'POST',
        token: userToken,
      });
      // Também dispara 409 pela trava de conectividade (não erro 400 de corpo obrigatório)
      assert.equal(res.status, 409, 'Ausência de corpo deve ser permitida e acionar a lógica de limpeza');
    });

    it('6.5: GET /currais/{corralId}/limpezas - itens retornados devem ter formato CleanCmdResponseDTO', async () => {
      const res = await apiRequest<CleanCmdResponseDTO[]>(`/currais/${corralId}/limpezas`, {
        token: userToken,
      });
      assert.equal(res.status, 200);
      if (res.data && res.data.length > 0) {
        const cmd = res.data[0];
        assert.ok('id' in cmd);
        assert.ok('corralId' in cmd);
        assert.ok('state' in cmd);
        assert.ok('secondsDuration' in cmd);
      }
    });
  });

  // --------------------------------------------------------------------------
  // Module 7: Telemetria de Odor (OdorController)
  // --------------------------------------------------------------------------
  describe('Module 7: Telemetria de Odor (OdorController)', () => {
    it('7.1: GET /currais/{corralId}/odor - deve retornar lista de leituras do sensor MQ-135', async () => {
      const res = await apiRequest<OdorTelemetryResponseDTO[]>(`/currais/${corralId}/odor`, {
        token: userToken,
      });

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.data), 'Resposta deve ser um array');
    });

    it('7.2: GET /currais/{corralId}/odor - para curral novo sem leituras, deve retornar lista vazia []', async () => {
      const newCorral = await createTestCorral(userToken, farmId);
      const res = await apiRequest<OdorTelemetryResponseDTO[]>(`/currais/${newCorral.id}/odor`, {
        token: userToken,
      });

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.data));
      assert.equal(res.data.length, 0, 'Curral novo não deve ter leituras registradas');
    });

    it('7.3: GET /currais/{corralId}/odor - resposta deve respeitar o limite máximo de 30 leituras', async () => {
      const res = await apiRequest<OdorTelemetryResponseDTO[]>(`/currais/${corralId}/odor`, {
        token: userToken,
      });

      assert.equal(res.status, 200);
      assert.ok(res.data!.length <= 30, 'Número de leituras não pode ultrapassar 30');
    });

    it('7.4: GET /currais/{corralId}/odor - cada leitura de telemetria deve conter campos esperados', async () => {
      const res = await apiRequest<OdorTelemetryResponseDTO[]>(`/currais/${corralId}/odor`, {
        token: userToken,
      });
      assert.equal(res.status, 200);
      if (res.data && res.data.length > 0) {
        const reading = res.data[0];
        assert.ok(typeof reading.id === 'number');
        assert.equal(reading.corralId, corralId);
        assert.ok(typeof reading.value === 'number');
        assert.ok(typeof reading.instant === 'string');
      }
    });

    it('7.5: GET /currais/{corralId}/odor - deve retornar status 200 mesmo em chamadas repetidas', async () => {
      const res1 = await apiRequest(`/currais/${corralId}/odor`, { token: userToken });
      const res2 = await apiRequest(`/currais/${corralId}/odor`, { token: userToken });
      assert.equal(res1.status, 200);
      assert.equal(res2.status, 200);
    });
  });
});

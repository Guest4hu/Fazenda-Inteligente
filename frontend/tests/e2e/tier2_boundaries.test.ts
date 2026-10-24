import { describe, it, before } from 'node:test';
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
  FarmResponseDTO,
  CorralResponseDTO,
  AnimalResponseDTO,
} from './test_helper';

describe('Tier 2: Boundary & Corner Cases (Adversarial Error Handling & RFC 7807)', () => {
  // Test user A (Owner)
  let userA: { token: string; userId: number; email: string };
  let farmA: FarmResponseDTO;
  let corralA: CorralResponseDTO;
  let animalA: AnimalResponseDTO;

  // Test user B (Attacker / Different Tenant)
  let userB: { token: string; userId: number; email: string };
  let farmB: FarmResponseDTO;

  before(async () => {
    userA = await createTestUser('Owner A');
    farmA = await createTestFarm(userA.token, `Farm Owner A ${uniqueId()}`);
    corralA = await createTestCorral(userA.token, farmA.id);
    animalA = await createTestAnimal(userA.token, farmA.id);

    userB = await createTestUser('Attacker B');
    farmB = await createTestFarm(userB.token, `Farm Attacker B ${uniqueId()}`);
  });

  // --------------------------------------------------------------------------
  // Feature 1: Auth Boundaries & Validations
  // --------------------------------------------------------------------------
  describe('Feature 1: Autenticação (Erros de Validação, Credenciais e Formatos)', () => {
    it('1.1: POST /auth/register - campos vazios devem retornar 400 com mapa invalidParams', async () => {
      const res = await apiRequest('/auth/register', {
        method: 'POST',
        body: { name: '', email: '', password: '' },
      });

      assert.equal(res.status, 400);
      assert.equal(res.error?.title, 'Erro de Validação');
      assert.ok(res.error?.invalidParams);
      assert.ok(res.error.invalidParams.name, 'Deve conter erro no campo name');
      assert.ok(res.error.invalidParams.email, 'Deve conter erro no campo email');
      assert.ok(res.error.invalidParams.password, 'Deve conter erro no campo password');
    });

    it('1.2: POST /auth/register - email inválido deve ser rejeitado com 400', async () => {
      const res = await apiRequest('/auth/register', {
        method: 'POST',
        body: {
          name: 'Produtor Teste',
          email: 'not-an-email',
          password: 'Password@123',
        },
      });

      assert.equal(res.status, 400);
      assert.ok(res.error?.invalidParams?.email);
    });

    it('1.3: POST /auth/register - senha com menos de 6 caracteres deve ser rejeitada com 400', async () => {
      const res = await apiRequest('/auth/register', {
        method: 'POST',
        body: {
          name: 'Produtor Teste',
          email: randomEmail(),
          password: '123',
        },
      });

      assert.equal(res.status, 400);
      assert.ok(res.error?.invalidParams?.password);
    });

    it('1.4: POST /auth/register - nome com menos de 3 caracteres deve ser rejeitado com 400', async () => {
      const res = await apiRequest('/auth/register', {
        method: 'POST',
        body: {
          name: 'Jo',
          email: randomEmail(),
          password: 'Password@123',
        },
      });

      assert.equal(res.status, 400);
      assert.ok(res.error?.invalidParams?.name);
    });

    it('1.5: POST /auth/register - email duplicado deve retornar 409 Conflict', async () => {
      const email = randomEmail();
      // Primeiro cadastro
      await apiRequest('/auth/register', {
        method: 'POST',
        body: { name: 'Produtor Original', email, password: 'Password@123' },
      });

      // Segundo cadastro com mesmo email
      const res = await apiRequest('/auth/register', {
        method: 'POST',
        body: { name: 'Produtor Clonado', email, password: 'Password@123' },
      });

      assert.equal(res.status, 409);
      assert.equal(res.error?.title, 'Conflito de Regra de Negócio');
      assert.ok(res.error?.detail?.includes('cadastado') || res.error?.detail?.includes('Email'));
    });

    it('1.6: POST /auth/login - email não cadastrado deve retornar 401 Unauthorized', async () => {
      const res = await apiRequest('/auth/login', {
        method: 'POST',
        body: {
          email: 'inexistente_999999@fazenda.com',
          password: 'Password@123',
        },
      });

      assert.equal(res.status, 401);
      assert.equal(res.error?.title, 'Credenciais Inválidas');
    });

    it('1.7: POST /auth/login - senha incorreta deve retornar 401 Unauthorized', async () => {
      const res = await apiRequest('/auth/login', {
        method: 'POST',
        body: {
          email: userA.email,
          password: 'WrongPassword999',
        },
      });

      assert.equal(res.status, 401);
      assert.equal(res.error?.title, 'Credenciais Inválidas');
    });

    it('1.8: Rota protegida sem header Authorization deve retornar 403 Forbidden', async () => {
      const res = await apiRequest('/farms');
      assert.equal(res.status, 403);
    });

    it('1.9: Rota protegida com token Bearer corrompido/falso deve retornar 403 Forbidden', async () => {
      const res = await apiRequest('/farms', {
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.INVALID_PAYLOAD.SIGNATURE',
      });
      assert.equal(res.status, 403);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 2: Farms Boundaries & Tenant Isolation
  // --------------------------------------------------------------------------
  describe('Feature 2: Fazendas (Isolamento de Tenants e Validação)', () => {
    it('2.1: POST /farms - nome em branco deve retornar 400 com invalidParams.name', async () => {
      const res = await apiRequest('/farms', {
        method: 'POST',
        token: userA.token,
        body: { name: '   ' },
      });

      assert.equal(res.status, 400);
      assert.ok(res.error?.invalidParams?.name);
    });

    it('2.2: POST /farms - nome com 1 caractere deve retornar 400 com invalidParams.name', async () => {
      const res = await apiRequest('/farms', {
        method: 'POST',
        token: userA.token,
        body: { name: 'F' },
      });

      assert.equal(res.status, 400);
      assert.ok(res.error?.invalidParams?.name);
    });

    it('2.3: POST /farms - nome duplicado para o mesmo usuário deve retornar 409 Conflict', async () => {
      const farmName = `Fazenda Duplicada ${uniqueId()}`;
      await apiRequest('/farms', {
        method: 'POST',
        token: userA.token,
        body: { name: farmName },
      });

      const res = await apiRequest('/farms', {
        method: 'POST',
        token: userA.token,
        body: { name: farmName },
      });

      assert.equal(res.status, 409);
      assert.equal(res.error?.title, 'Conflito de Regra de Negócio');
    });

    it('2.4: PUT /farms/{farmId} - tentar editar fazenda de outro usuário deve retornar 403 Forbidden', async () => {
      const res = await apiRequest(`/farms/${farmA.id}`, {
        method: 'PUT',
        token: userB.token, // Usuário B tentando editar fazenda do Usuário A
        body: { name: 'Fazenda Invadida' },
      });

      assert.equal(res.status, 403);
      assert.equal(res.error?.title, 'Acesso Negado');
    });

    it('2.5: DELETE /farms/{farmId} - tentar excluir fazenda de outro usuário deve retornar 403 Forbidden', async () => {
      const res = await apiRequest(`/farms/${farmA.id}`, {
        method: 'DELETE',
        token: userB.token,
      });

      assert.equal(res.status, 403);
      assert.equal(res.error?.title, 'Acesso Negado');
    });

    it('2.6: PUT /farms/{farmId} - ID de fazenda inexistente deve retornar 404 Not Found', async () => {
      const res = await apiRequest('/farms/9999999', {
        method: 'PUT',
        token: userA.token,
        body: { name: 'Inexistente' },
      });

      assert.equal(res.status, 404);
      assert.equal(res.error?.title, 'Recurso Não Encontrado');
    });

    it('2.7: DELETE /farms/{farmId} - ID de fazenda inexistente deve retornar 404 Not Found', async () => {
      const res = await apiRequest('/farms/9999999', {
        method: 'DELETE',
        token: userA.token,
      });

      assert.equal(res.status, 404);
      assert.equal(res.error?.title, 'Recurso Não Encontrado');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 3: Corrals Boundaries & Format Restrictions
  // --------------------------------------------------------------------------
  describe('Feature 3: Currais (MAC Address, Limites Operacionais e Conflitos)', () => {
    it('3.1: POST /farms/{farmId}/currais - MAC com caracteres não hexadecimais deve retornar 400', async () => {
      const res = await apiRequest(`/farms/${farmA.id}/currais`, {
        method: 'POST',
        token: userA.token,
        body: {
          name: 'Curral Invalido',
          macAddress: '240AC400011Z', // 'Z' não é hexadecimal
        },
      });

      assert.equal(res.status, 400);
      assert.ok(res.error?.invalidParams?.macAddress);
    });

    it('3.2: POST /farms/{farmId}/currais - MAC com dois-pontos (24:0A:C4:00:01:10) deve retornar 400', async () => {
      const res = await apiRequest(`/farms/${farmA.id}/currais`, {
        method: 'POST',
        token: userA.token,
        body: {
          name: 'Curral Com Pontos',
          macAddress: '24:0A:C4:00:01:10', // Deve conter exatamente 12 chars sem delimitadores
        },
      });

      assert.equal(res.status, 400);
      assert.ok(res.error?.invalidParams?.macAddress);
    });

    it('3.3: POST /farms/{farmId}/currais - MAC com tamanho menor que 12 deve retornar 400', async () => {
      const res = await apiRequest(`/farms/${farmA.id}/currais`, {
        method: 'POST',
        token: userA.token,
        body: {
          name: 'Curral Curto',
          macAddress: '240AC400', // 8 chars
        },
      });

      assert.equal(res.status, 400);
      assert.ok(res.error?.invalidParams?.macAddress);
    });

    it('3.4: POST /farms/{farmId}/currais - pumpDurationSeconds > 60 deve retornar 400', async () => {
      const res = await apiRequest(`/farms/${farmA.id}/currais`, {
        method: 'POST',
        token: userA.token,
        body: {
          name: 'Curral Bomba Longa',
          macAddress: randomMac(),
          pumpDurationSeconds: 61,
        },
      });

      assert.equal(res.status, 400);
      assert.ok(res.error?.invalidParams?.pumpDurationSeconds);
    });

    it('3.5: POST /farms/{farmId}/currais - pumpDurationSeconds < 1 deve retornar 400', async () => {
      const res = await apiRequest(`/farms/${farmA.id}/currais`, {
        method: 'POST',
        token: userA.token,
        body: {
          name: 'Curral Bomba Zero',
          macAddress: randomMac(),
          pumpDurationSeconds: 0,
        },
      });

      assert.equal(res.status, 400);
      assert.ok(res.error?.invalidParams?.pumpDurationSeconds);
    });

    it('3.6: POST /farms/{farmId}/currais - MAC já cadastrado em outro curral deve retornar 409 Conflict', async () => {
      const res = await apiRequest(`/farms/${farmA.id}/currais`, {
        method: 'POST',
        token: userA.token,
        body: {
          name: 'Curral Clone MAC',
          macAddress: corralA.macAddress, // MAC já em uso por corralA
        },
      });

      assert.equal(res.status, 409);
      assert.equal(res.error?.title, 'Conflito de Regra de Negócio');
    });

    it('3.7: POST /farms/{farmId}/currais - cadastrar curral em fazenda de outro usuário deve retornar 403 Forbidden', async () => {
      const res = await apiRequest(`/farms/${farmA.id}/currais`, {
        method: 'POST',
        token: userB.token, // Usuário B tentando criar em fazenda do A
        body: {
          name: 'Curral Invasor',
          macAddress: randomMac(),
        },
      });

      assert.equal(res.status, 403);
      assert.equal(res.error?.title, 'Acesso Negado');
    });

    it('3.8: GET /currais/{corralId} - acessar curral de outro usuário deve retornar 403 Forbidden', async () => {
      const res = await apiRequest(`/currais/${corralA.id}`, {
        token: userB.token,
      });

      assert.equal(res.status, 403);
      assert.equal(res.error?.title, 'Acesso Negado');
    });

    it('3.9: GET /farms/{farmA}/currais/{corralA} com ID de fazenda divergente deve retornar 404', async () => {
      // Fazenda B não é dona de corralA
      const res = await apiRequest(`/farms/${farmB.id}/currais/${corralA.id}`, {
        token: userB.token,
      });

      // Retorna 403 ou 404
      assert.ok(res.status === 403 || res.status === 404);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 4: Animals Boundaries & Presence Rules
  // --------------------------------------------------------------------------
  describe('Feature 4: Animais e Presença (Validação, Tags Duplicadas e Erros de Presença)', () => {
    it('4.1: POST /farms/{farmId}/animais - nome em branco deve retornar 400', async () => {
      const res = await apiRequest(`/farms/${farmA.id}/animais`, {
        method: 'POST',
        token: userA.token,
        body: {
          name: '   ',
          tagUid: randomTagUid(),
        },
      });

      assert.equal(res.status, 400);
      assert.ok(res.error?.invalidParams?.name);
    });

    it('4.2: POST /farms/{farmId}/animais - tagUid em branco deve retornar 400', async () => {
      const res = await apiRequest(`/farms/${farmA.id}/animais`, {
        method: 'POST',
        token: userA.token,
        body: {
          name: 'Vaca Sem Tag',
          tagUid: '   ',
        },
      });

      assert.equal(res.status, 400);
      assert.ok(res.error?.invalidParams?.tagUid);
    });

    it('4.3: POST /farms/{farmId}/animais - Tag RFID duplicada no sistema deve retornar 409 Conflict', async () => {
      const res = await apiRequest(`/farms/${farmA.id}/animais`, {
        method: 'POST',
        token: userA.token,
        body: {
          name: 'Vaca Clonada',
          tagUid: animalA.tagUid, // Tag já cadastrada
        },
      });

      assert.equal(res.status, 409);
      assert.equal(res.error?.title, 'Conflito de Regra de Negócio');
    });

    it('4.4: POST /farms/{farmId}/animais - cadastrar animal em fazenda de outro usuário deve retornar 403', async () => {
      const res = await apiRequest(`/farms/${farmA.id}/animais`, {
        method: 'POST',
        token: userB.token,
        body: {
          name: 'Animal Invasor',
          tagUid: randomTagUid(),
        },
      });

      assert.equal(res.status, 403);
    });

    it('4.5: GET /animais/{animalId} - consultar animal inexistente deve retornar 404', async () => {
      const res = await apiRequest('/animais/9999999', {
        token: userA.token,
      });

      assert.equal(res.status, 404);
      assert.equal(res.error?.title, 'Recurso Não Encontrado');
    });

    it('4.6: GET /animais/{animalId} - consultar animal de outro usuário deve retornar 403', async () => {
      const res = await apiRequest(`/animais/${animalA.id}`, {
        token: userB.token,
      });

      assert.equal(res.status, 403);
    });

    it('4.7: POST /currais/{corralId}/presenca - registrar presença com tag não cadastrada deve retornar 404', async () => {
      const res = await apiRequest(`/currais/${corralA.id}/presenca`, {
        method: 'POST',
        token: userA.token,
        body: {
          tagUid: 'TAG_INEXISTENTE_9999',
          typeEvent: 'ENTROU',
        },
      });

      assert.equal(res.status, 404);
      assert.equal(res.error?.title, 'Recurso Não Encontrado');
    });

    it('4.8: POST /currais/{corralId}/presenca - registrar evento com tipo inválido deve retornar 400', async () => {
      const res = await apiRequest(`/currais/${corralA.id}/presenca`, {
        method: 'POST',
        token: userA.token,
        body: {
          tagUid: animalA.tagUid,
          typeEvent: 'CORREU', // Inválido: apenas ENTROU ou SAIU
        },
      });

      assert.equal(res.status, 400);
    });

    it('4.9: POST /currais/{corralId}/presenca - registrar presença no curral de outro usuário deve retornar 403', async () => {
      const res = await apiRequest(`/currais/${corralA.id}/presenca`, {
        method: 'POST',
        token: userB.token,
        body: {
          tagUid: animalA.tagUid,
          typeEvent: 'ENTROU',
        },
      });

      assert.equal(res.status, 403);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 5: Pendencies Boundaries
  // --------------------------------------------------------------------------
  describe('Feature 5: Pendências RFID (Validação e Permissões)', () => {
    it('5.1: GET /currais/{corralId}/pendencias - curral de outro usuário deve retornar 403', async () => {
      const res = await apiRequest(`/currais/${corralA.id}/pendencias`, {
        token: userB.token,
      });

      assert.equal(res.status, 403);
    });

    it('5.2: GET /currais/{corralId}/pendencias - curral inexistente deve retornar 404', async () => {
      const res = await apiRequest('/currais/9999999/pendencias', {
        token: userA.token,
      });

      assert.equal(res.status, 404);
    });

    it('5.3: POST /pendencias/{pendencyId}/resolver - resolver com animalId nulo/ausente deve retornar 400', async () => {
      const res = await apiRequest('/pendencias/1/resolver', {
        method: 'POST',
        token: userA.token,
        body: {},
      });

      assert.equal(res.status, 400);
      assert.ok(res.error?.invalidParams?.animalId);
    });

    it('5.4: POST /pendencias/{pendencyId}/resolver - pendência inexistente deve retornar 404', async () => {
      const res = await apiRequest('/pendencias/9999999/resolver', {
        method: 'POST',
        token: userA.token,
        body: { animalId: animalA.id },
      });

      assert.equal(res.status, 404);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 6: Cleaning Boundaries & Biological Locks
  // --------------------------------------------------------------------------
  describe('Feature 6: Limpeza e Travas de Segurança (Biológica, Conectividade e Concorrência)', () => {
    it('6.1: POST /currais/{corralId}/limpeza - duração superior a 60s deve retornar 400', async () => {
      const res = await apiRequest(`/currais/${corralA.id}/limpeza`, {
        method: 'POST',
        token: userA.token,
        body: {
          origin: 'MANUAL',
          secondsDuration: 90, // Max 60s
        },
      });

      assert.equal(res.status, 400);
    });

    it('6.2: POST /currais/{corralId}/limpeza - curral inexistente deve retornar 404', async () => {
      const res = await apiRequest('/currais/9999999/limpeza', {
        method: 'POST',
        token: userA.token,
      });

      assert.equal(res.status, 404);
    });

    it('6.3: POST /currais/{corralId}/limpeza - curral de outro produtor deve retornar 403', async () => {
      const res = await apiRequest(`/currais/${corralA.id}/limpeza`, {
        method: 'POST',
        token: userB.token,
      });

      assert.equal(res.status, 403);
    });

    it('6.4: POST /currais/{corralId}/limpeza - TRAVA BIOLÓGICA: deve retornar 409 quando há animal no curral', async () => {
      // 1. Coloca o animal dentro do curral
      await apiRequest(`/currais/${corralA.id}/presenca`, {
        method: 'POST',
        token: userA.token,
        body: {
          tagUid: animalA.tagUid,
          typeEvent: 'ENTROU',
        },
      });

      // 2. Tenta acionar a bomba de limpeza
      const res = await apiRequest(`/currais/${corralA.id}/limpeza`, {
        method: 'POST',
        token: userA.token,
        body: { secondsDuration: 15 },
      });

      assert.equal(res.status, 409, 'Presença de animal no curral deve disparar 409');
      assert.ok(
        res.error?.detail?.includes('vaca no curral'),
        `Mensagem da trava biológica esperada, recebido: ${res.error?.detail}`
      );

      // Limpeza do estado: retira o animal do curral
      await apiRequest(`/currais/${corralA.id}/presenca`, {
        method: 'POST',
        token: userA.token,
        body: {
          tagUid: animalA.tagUid,
          typeEvent: 'SAIU',
        },
      });
    });

    it('6.5: POST /currais/{corralId}/limpeza - TRAVA DE CONECTIVIDADE: deve retornar 409 quando dispositivo está OFFLINE', async () => {
      // Animal já está fora do curral (trava biológica liberada)
      const res = await apiRequest(`/currais/${corralA.id}/limpeza`, {
        method: 'POST',
        token: userA.token,
      });

      assert.equal(res.status, 409);
      assert.ok(
        res.error?.detail?.includes('offline') || res.error?.detail?.includes('comunicação'),
        `Mensagem de conectividade esperada, recebido: ${res.error?.detail}`
      );
    });

    it('6.6: GET /currais/{corralId}/limpezas - curral de outro produtor deve retornar 403', async () => {
      const res = await apiRequest(`/currais/${corralA.id}/limpezas`, {
        token: userB.token,
      });

      assert.equal(res.status, 403);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 7: Odor Boundaries
  // --------------------------------------------------------------------------
  describe('Feature 7: Telemetria de Odor (Permissões e IDs Inválidos)', () => {
    it('7.1: GET /currais/{corralId}/odor - curral inexistente deve retornar 404', async () => {
      const res = await apiRequest('/currais/9999999/odor', {
        token: userA.token,
      });

      assert.equal(res.status, 404);
    });

    it('7.2: GET /currais/{corralId}/odor - curral de outro usuário deve retornar 403', async () => {
      const res = await apiRequest(`/currais/${corralA.id}/odor`, {
        token: userB.token,
      });

      assert.equal(res.status, 403);
    });

    it('7.3: GET /currais/{corralId}/odor - sem token deve retornar 403', async () => {
      const res = await apiRequest(`/currais/${corralA.id}/odor`);
      assert.equal(res.status, 403);
    });

    it('7.4: GET /currais/{corralId}/odor - ID de borda zero (0) deve retornar 404 Recurso Não Encontrado', async () => {
      const res = await apiRequest('/currais/0/odor', {
        token: userA.token,
      });
      assert.equal(res.status, 404);
      assert.equal(res.error?.title, 'Recurso Não Encontrado');
    });

    it('7.5: GET /currais/{corralId}/odor - ID negativo (-1) deve retornar 404 Recurso Não Encontrado', async () => {
      const res = await apiRequest('/currais/-1/odor', {
        token: userA.token,
      });
      assert.equal(res.status, 404);
      assert.equal(res.error?.title, 'Recurso Não Encontrado');
    });

    it('7.6: GET /currais/{corralId}/odor - ID não numérico deve retornar resposta de erro padronizada RFC 7807', async () => {
      const res = await apiRequest('/currais/abc-invalid/odor', {
        token: userA.token,
      });
      assert.ok(res.status >= 400, 'Status deve indicar erro (4xx ou 5xx)');
      assert.ok(res.error?.title, 'Deve retornar payload estruturado RFC 7807 com title');
      assert.ok(res.error?.detail, 'Deve conter detail explicativo');
    });
  });
});

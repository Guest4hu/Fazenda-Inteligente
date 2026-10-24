import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import {
  apiRequest,
  createTestUser,
  createTestFarm,
  createTestCorral,
  createTestAnimal,
  randomMac,
  randomTagUid,
  uniqueId,
  FarmResponseDTO,
  CorralResponseDTO,
  AnimalResponseDTO,
  CorralMetricsResponseDTO,
} from './test_helper';

describe('Tier 3: Cross-Feature Combinations (Pairwise Module Interactions)', () => {
  let userA: { token: string; userId: number; email: string };
  let farmA: FarmResponseDTO;

  before(async () => {
    userA = await createTestUser('Tier3 Owner');
    farmA = await createTestFarm(userA.token, `Fazenda Matrix ${uniqueId()}`);
  });

  // --------------------------------------------------------------------------
  // Combination 1: Auth <-> Farms (Multi-tenant Name Isolation)
  // --------------------------------------------------------------------------
  it('3.1: Auth <-> Farms: usuários distintos podem criar fazendas com mesmo nome sem colisão', async () => {
    const userB = await createTestUser('Tier3 User B');
    const sharedFarmName = `Fazenda Compartilhada ${uniqueId()}`;

    // Usuário A cria
    const farmResA = await apiRequest<FarmResponseDTO>('/farms', {
      method: 'POST',
      token: userA.token,
      body: { name: sharedFarmName },
    });
    assert.equal(farmResA.status, 201);

    // Usuário B cria com o mesmo nome exato
    const farmResB = await apiRequest<FarmResponseDTO>('/farms', {
      method: 'POST',
      token: userB.token,
      body: { name: sharedFarmName },
    });
    assert.equal(farmResB.status, 201);
    assert.notEqual(farmResA.data?.id, farmResB.data?.id, 'IDs devem ser distintos');

    // Listagem do Usuário A não vê fazenda do Usuário B
    const listA = await apiRequest<FarmResponseDTO[]>('/farms', { token: userA.token });
    const userAfarmIds = listA.data?.map((f) => f.id) || [];
    assert.ok(userAfarmIds.includes(farmResA.data!.id));
    assert.ok(!userAfarmIds.includes(farmResB.data!.id), 'Usuário A não pode ver fazenda do Usuário B');
  });

  // --------------------------------------------------------------------------
  // Combination 2: Farms <-> Corrais (Múltiplos Currais e Exclusão Seletiva)
  // --------------------------------------------------------------------------
  it('3.2: Farms <-> Currais: exclusão de um curral específico preserva outros currais da mesma fazenda', async () => {
    const corral1 = await createTestCorral(userA.token, farmA.id, { name: 'Curral 1' });
    const corral2 = await createTestCorral(userA.token, farmA.id, { name: 'Curral 2' });

    // Exclui apenas Corral 1
    const delRes = await apiRequest(`/currais/${corral1.id}`, {
      method: 'DELETE',
      token: userA.token,
    });
    assert.equal(delRes.status, 204);

    // Consulta currais da fazenda
    const listRes = await apiRequest<CorralResponseDTO[]>(`/farms/${farmA.id}/currais`, {
      token: userA.token,
    });
    const ids = listRes.data?.map((c) => c.id) || [];
    assert.ok(!ids.includes(corral1.id), 'Curral 1 não deve mais existir');
    assert.ok(ids.includes(corral2.id), 'Curral 2 deve permanecer intacto');
  });

  // --------------------------------------------------------------------------
  // Combination 3: Currais <-> Animais <-> Presença (Movimentação Entre Currais)
  // --------------------------------------------------------------------------
  it('3.3: Currais <-> Animais: movimentação de animal entre currais atualiza currentCorralId dinamicamente', async () => {
    const corralSource = await createTestCorral(userA.token, farmA.id, { name: 'Curral Origem' });
    const corralTarget = await createTestCorral(userA.token, farmA.id, { name: 'Curral Destino' });
    const animal = await createTestAnimal(userA.token, farmA.id, { name: 'Vaca Viajante' });

    // Inicialmente fora do curral
    assert.equal(animal.currentCorralId, null);

    // 1. Entra no Curral Origem
    await apiRequest(`/currais/${corralSource.id}/presenca`, {
      method: 'POST',
      token: userA.token,
      body: { tagUid: animal.tagUid, typeEvent: 'ENTROU' },
    });
    const check1 = await apiRequest<AnimalResponseDTO>(`/animais/${animal.id}`, { token: userA.token });
    assert.equal(check1.data?.currentCorralId, corralSource.id);

    // 2. Entra no Curral Destino (transferência)
    await apiRequest(`/currais/${corralTarget.id}/presenca`, {
      method: 'POST',
      token: userA.token,
      body: { tagUid: animal.tagUid, typeEvent: 'ENTROU' },
    });
    const check2 = await apiRequest<AnimalResponseDTO>(`/animais/${animal.id}`, { token: userA.token });
    assert.equal(check2.data?.currentCorralId, corralTarget.id);

    // 3. Sai do Curral Destino
    await apiRequest(`/currais/${corralTarget.id}/presenca`, {
      method: 'POST',
      token: userA.token,
      body: { tagUid: animal.tagUid, typeEvent: 'SAIU' },
    });
    const check3 = await apiRequest<AnimalResponseDTO>(`/animais/${animal.id}`, { token: userA.token });
    assert.equal(check3.data?.currentCorralId, null);
  });

  // --------------------------------------------------------------------------
  // Combination 4: Animais <-> Presença <-> Métricas do Dashboard
  // --------------------------------------------------------------------------
  it('3.4: Animais <-> Presença <-> Métricas: contadores de lotação no dashboard refletem entradas e saídas', async () => {
    const farm = await createTestFarm(userA.token, `Fazenda Metricas ${uniqueId()}`);
    const corral = await createTestCorral(userA.token, farm.id);

    const cow1 = await createTestAnimal(userA.token, farm.id, { name: 'Vaca 1' });
    const cow2 = await createTestAnimal(userA.token, farm.id, { name: 'Vaca 2' });

    // Métricas iniciais: 2 na fazenda, 0 no curral
    const m0 = await apiRequest<CorralMetricsResponseDTO>(`/currais/${corral.id}/metricas`, { token: userA.token });
    assert.equal(m0.data?.totalAnimaisNaFazenda, 2);
    assert.equal(m0.data?.totalAnimaisNoCurral, 0);

    // Cow 1 entra no curral -> totalAnimaisNoCurral = 1
    await apiRequest(`/currais/${corral.id}/presenca`, {
      method: 'POST',
      token: userA.token,
      body: { tagUid: cow1.tagUid, typeEvent: 'ENTROU' },
    });
    const m1 = await apiRequest<CorralMetricsResponseDTO>(`/currais/${corral.id}/metricas`, { token: userA.token });
    assert.equal(m1.data?.totalAnimaisNoCurral, 1);

    // Cow 2 entra no curral -> totalAnimaisNoCurral = 2
    await apiRequest(`/currais/${corral.id}/presenca`, {
      method: 'POST',
      token: userA.token,
      body: { tagUid: cow2.tagUid, typeEvent: 'ENTROU' },
    });
    const m2 = await apiRequest<CorralMetricsResponseDTO>(`/currais/${corral.id}/metricas`, { token: userA.token });
    assert.equal(m2.data?.totalAnimaisNoCurral, 2);

    // Cow 1 sai do curral -> totalAnimaisNoCurral = 1
    await apiRequest(`/currais/${corral.id}/presenca`, {
      method: 'POST',
      token: userA.token,
      body: { tagUid: cow1.tagUid, typeEvent: 'SAIU' },
    });
    const m3 = await apiRequest<CorralMetricsResponseDTO>(`/currais/${corral.id}/metricas`, { token: userA.token });
    assert.equal(m3.data?.totalAnimaisNoCurral, 1);

    // Cow 2 sai do curral -> totalAnimaisNoCurral = 0
    await apiRequest(`/currais/${corral.id}/presenca`, {
      method: 'POST',
      token: userA.token,
      body: { tagUid: cow2.tagUid, typeEvent: 'SAIU' },
    });
    const m4 = await apiRequest<CorralMetricsResponseDTO>(`/currais/${corral.id}/metricas`, { token: userA.token });
    assert.equal(m4.data?.totalAnimaisNoCurral, 0);
  });

  // --------------------------------------------------------------------------
  // Combination 5: Presença <-> Trava Biológica de Limpeza
  // --------------------------------------------------------------------------
  it('3.5: Presença <-> Limpeza: presença de animal trava bomba e saída destrava dinamicamente', async () => {
    const corral = await createTestCorral(userA.token, farmA.id);
    const cow = await createTestAnimal(userA.token, farmA.id);

    // 1. Curral vazio: trava biológica liberada (retorna erro de conectividade/offline, não de vaca)
    const resEmpty = await apiRequest(`/currais/${corral.id}/limpeza`, {
      method: 'POST',
      token: userA.token,
    });
    assert.equal(resEmpty.status, 409);
    assert.ok(
      !resEmpty.error?.detail?.includes('vaca no curral'),
      'Curral vazio não deve indicar trava biológica'
    );

    // 2. Vaca entra no curral: trava biológica ativada
    await apiRequest(`/currais/${corral.id}/presenca`, {
      method: 'POST',
      token: userA.token,
      body: { tagUid: cow.tagUid, typeEvent: 'ENTROU' },
    });
    const resOccupied = await apiRequest(`/currais/${corral.id}/limpeza`, {
      method: 'POST',
      token: userA.token,
    });
    assert.equal(resOccupied.status, 409);
    assert.ok(
      resOccupied.error?.detail?.includes('vaca no curral'),
      `Esperado erro de trava biológica, recebido: ${resOccupied.error?.detail}`
    );

    // 3. Vaca sai do curral: trava biológica liberada imediatamente
    await apiRequest(`/currais/${corral.id}/presenca`, {
      method: 'POST',
      token: userA.token,
      body: { tagUid: cow.tagUid, typeEvent: 'SAIU' },
    });
    const resVacated = await apiRequest(`/currais/${corral.id}/limpeza`, {
      method: 'POST',
      token: userA.token,
    });
    assert.equal(resVacated.status, 409);
    assert.ok(
      !resVacated.error?.detail?.includes('vaca no curral'),
      'Após saída da vaca, a trava biológica deve estar liberada'
    );
  });

  // --------------------------------------------------------------------------
  // Combination 6: Currais <-> Exclusão e Cascata em Animais
  // --------------------------------------------------------------------------
  it('3.6: Currais <-> Animais: excluir curral reseta currentCorralId dos animais para null com segurança', async () => {
    const corral = await createTestCorral(userA.token, farmA.id);
    const cow = await createTestAnimal(userA.token, farmA.id);

    // Aloca animal no curral
    await apiRequest(`/currais/${corral.id}/presenca`, {
      method: 'POST',
      token: userA.token,
      body: { tagUid: cow.tagUid, typeEvent: 'ENTROU' },
    });

    // Exclui o curral
    const delRes = await apiRequest(`/currais/${corral.id}`, {
      method: 'DELETE',
      token: userA.token,
    });
    assert.equal(delRes.status, 204);

    // Animal agora deve ter currentCorralId == null sem erro de integridade referencial
    const animalRes = await apiRequest<AnimalResponseDTO>(`/animais/${cow.id}`, { token: userA.token });
    assert.equal(animalRes.status, 200);
    assert.equal(animalRes.data?.currentCorralId, null);
  });

  // --------------------------------------------------------------------------
  // Combination 7: Rotas Aninhadas vs Diretas
  // --------------------------------------------------------------------------
  it('3.7: Rotas: equivalência estrutural exata entre rotas diretas (/currais/...) e aninhadas (/farms/.../currais/...)', async () => {
    const corral = await createTestCorral(userA.token, farmA.id, {
      name: 'Curral Equivalente',
      cleanTime: '09:00:00',
      limitOdor: 410,
      pumpDurationSeconds: 22,
    });

    const directRes = await apiRequest<CorralResponseDTO>(`/currais/${corral.id}`, { token: userA.token });
    const nestedRes = await apiRequest<CorralResponseDTO>(`/farms/${farmA.id}/currais/${corral.id}`, { token: userA.token });

    assert.equal(directRes.status, 200);
    assert.equal(nestedRes.status, 200);
    assert.deepEqual(directRes.data, nestedRes.data, 'Ambas as rotas devem retornar o mesmo objeto JSON');

    // Métricas direta vs aninhada
    const directM = await apiRequest(`/currais/${corral.id}/metricas`, { token: userA.token });
    const nestedM = await apiRequest(`/farms/${farmA.id}/currais/${corral.id}/metricas`, { token: userA.token });
    assert.equal(directM.status, 200);
    assert.equal(nestedM.status, 200);
    assert.deepEqual(directM.data, nestedM.data);
  });

  // --------------------------------------------------------------------------
  // Combination 8: Isolamento Cruzado de Fazenda em Rotas Aninhadas
  // --------------------------------------------------------------------------
  it('3.8: Rotas Aninhadas: acessar curral informando farmId incorreto na URL deve retornar 404', async () => {
    const otherFarm = await createTestFarm(userA.token, `Outra Fazenda ${uniqueId()}`);
    const corral = await createTestCorral(userA.token, farmA.id);

    // Corral pertence a farmA, mas URL especifica otherFarm
    const mismatchRes = await apiRequest(`/farms/${otherFarm.id}/currais/${corral.id}`, {
      token: userA.token,
    });

    assert.equal(mismatchRes.status, 404, 'Curral informado em fazenda incorreta deve retornar 404');
    assert.ok(
      mismatchRes.error?.detail?.includes('não pertence') || mismatchRes.error?.title?.includes('Recurso Não Encontrado')
    );
  });
});

/**
 * tests/e2e/m3_adversarial_challenge.test.ts
 * Milestone 3 Adversarial Empirical Challenge Suite
 * 
 * Verifies live Spring Boot backend integration at http://localhost:8080/api/v1:
 * 1. Invalid MAC addresses (format, non-hex, delimiters, length, duplicate conflict 409)
 * 2. Malformed passwords (empty, short, null, spaces, invalid login credentials)
 * 3. Duplicate emails (409 conflict, invalid email format syntax)
 * 4. Unauthorized token access (missing token, invalid token, cross-tenant isolation on all resources)
 * 5. 409 Biological lock (single animal, multiple animals, partial exit, lock precedence and release)
 */

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

describe('Milestone 3 Empirical Adversarial Challenge: Live Backend Integration', () => {
  let tenantA: { token: string; userId: number; email: string };
  let farmA: FarmResponseDTO;
  let corralA: CorralResponseDTO;
  let animalA1: AnimalResponseDTO;
  let animalA2: AnimalResponseDTO;

  let tenantB: { token: string; userId: number; email: string };
  let farmB: FarmResponseDTO;

  before(async () => {
    // Setup Tenant A (Owner)
    tenantA = await createTestUser('Owner Challenger A');
    farmA = await createTestFarm(tenantA.token, `Fazenda Challenger A ${uniqueId()}`);
    corralA = await createTestCorral(tenantA.token, farmA.id);
    animalA1 = await createTestAnimal(tenantA.token, farmA.id);
    animalA2 = await createTestAnimal(tenantA.token, farmA.id);

    // Setup Tenant B (Attacker / Different Tenant)
    tenantB = await createTestUser('Attacker Challenger B');
    farmB = await createTestFarm(tenantB.token, `Fazenda Attacker B ${uniqueId()}`);
  });

  // ==========================================================================
  // Challenge 1: Invalid MAC Addresses & Collision Boundaries
  // ==========================================================================
  describe('Challenge 1: Invalid MAC Addresses & Constraints', () => {
    it('1.1: Direct API rejection for MAC with non-hex characters (400 Bad Request)', async () => {
      const res = await apiRequest(`/farms/${farmA.id}/currais`, {
        method: 'POST',
        token: tenantA.token,
        body: {
          name: 'Curral NonHex',
          macAddress: '240AC400011Z', // 'Z' is not hex
        },
      });
      assert.equal(res.status, 400, 'Expected 400 for non-hex MAC');
      assert.ok(res.error?.invalidParams?.macAddress, 'invalidParams.macAddress must be present');
    });

    it('1.2: Direct API rejection for MAC formatted with colons (400 Bad Request)', async () => {
      const res = await apiRequest(`/farms/${farmA.id}/currais`, {
        method: 'POST',
        token: tenantA.token,
        body: {
          name: 'Curral Colon',
          macAddress: '24:0A:C4:00:01:10',
        },
      });
      assert.equal(res.status, 400, 'Backend requires raw 12-char hex without colons');
      assert.ok(res.error?.invalidParams?.macAddress);
    });

    it('1.3: Direct API rejection for MAC with hyphens (400 Bad Request)', async () => {
      const res = await apiRequest(`/farms/${farmA.id}/currais`, {
        method: 'POST',
        token: tenantA.token,
        body: {
          name: 'Curral Hyphen',
          macAddress: '24-0A-C4-00-01-10',
        },
      });
      assert.equal(res.status, 400, 'Backend requires raw 12-char hex without hyphens');
      assert.ok(res.error?.invalidParams?.macAddress);
    });

    it('1.4: Direct API rejection for short MAC (< 12 chars) (400 Bad Request)', async () => {
      const res = await apiRequest(`/farms/${farmA.id}/currais`, {
        method: 'POST',
        token: tenantA.token,
        body: {
          name: 'Curral Short',
          macAddress: '240AC4',
        },
      });
      assert.equal(res.status, 400, 'Short MAC must be rejected');
      assert.ok(res.error?.invalidParams?.macAddress);
    });

    it('1.5: Direct API rejection for long MAC (> 12 chars) (400 Bad Request)', async () => {
      const res = await apiRequest(`/farms/${farmA.id}/currais`, {
        method: 'POST',
        token: tenantA.token,
        body: {
          name: 'Curral Long',
          macAddress: '240AC4000110FFFF',
        },
      });
      assert.equal(res.status, 400, 'Long MAC must be rejected');
      assert.ok(res.error?.invalidParams?.macAddress);
    });

    it('1.6: Direct API rejection for empty MAC string (400 Bad Request)', async () => {
      const res = await apiRequest(`/farms/${farmA.id}/currais`, {
        method: 'POST',
        token: tenantA.token,
        body: {
          name: 'Curral Empty MAC',
          macAddress: '',
        },
      });
      assert.equal(res.status, 400, 'Empty MAC must be rejected');
      assert.ok(res.error?.invalidParams?.macAddress);
    });

    it('1.7: Duplicate MAC address across currais returns 409 Conflict', async () => {
      const res = await apiRequest(`/farms/${farmA.id}/currais`, {
        method: 'POST',
        token: tenantA.token,
        body: {
          name: 'Curral Duplicate MAC',
          macAddress: corralA.macAddress,
        },
      });
      assert.equal(res.status, 409, 'Duplicate MAC must return 409');
      assert.equal(res.error?.title, 'Conflito de Regra de Negócio');
    });
  });

  // ==========================================================================
  // Challenge 2: Malformed Passwords & Authentication Failures
  // ==========================================================================
  describe('Challenge 2: Malformed Passwords & Authentication Boundaries', () => {
    it('2.1: Register with empty password returns 400 with invalidParams.password', async () => {
      const res = await apiRequest('/auth/register', {
        method: 'POST',
        body: {
          name: 'Test User',
          email: randomEmail(),
          password: '',
        },
      });
      assert.equal(res.status, 400);
      assert.ok(res.error?.invalidParams?.password);
    });

    it('2.2: Register with short password (< 6 chars) returns 400', async () => {
      const res = await apiRequest('/auth/register', {
        method: 'POST',
        body: {
          name: 'Test User',
          email: randomEmail(),
          password: '12345',
        },
      });
      assert.equal(res.status, 400);
      assert.ok(res.error?.invalidParams?.password);
    });

    it('2.3: Register with missing password property returns 400', async () => {
      const res = await apiRequest('/auth/register', {
        method: 'POST',
        body: {
          name: 'Test User',
          email: randomEmail(),
        },
      });
      assert.equal(res.status, 400);
      assert.ok(res.error?.invalidParams?.password);
    });

    it('2.4: Register with space-only password returns 400', async () => {
      const res = await apiRequest('/auth/register', {
        method: 'POST',
        body: {
          name: 'Test User',
          email: randomEmail(),
          password: '      ',
        },
      });
      assert.equal(res.status, 400);
      assert.ok(res.error?.invalidParams?.password);
    });

    it('2.5: Login with unregistered email returns 401 Unauthorized', async () => {
      const res = await apiRequest('/auth/login', {
        method: 'POST',
        body: {
          email: 'unknown_ghost_user_99999@fazenda.com',
          password: 'Password@123',
        },
      });
      assert.equal(res.status, 401);
      assert.equal(res.error?.title, 'Credenciais Inválidas');
    });

    it('2.6: Login with registered email but incorrect password returns 401 Unauthorized', async () => {
      const res = await apiRequest('/auth/login', {
        method: 'POST',
        body: {
          email: tenantA.email,
          password: 'CompletelyWrongPassword!999',
        },
      });
      assert.equal(res.status, 401);
      assert.equal(res.error?.title, 'Credenciais Inválidas');
    });

    it('2.7: Login with empty password returns 400 Bad Request', async () => {
      const res = await apiRequest('/auth/login', {
        method: 'POST',
        body: {
          email: tenantA.email,
          password: '',
        },
      });
      assert.equal(res.status, 400);
      assert.ok(res.error?.invalidParams?.password);
    });
  });

  // ==========================================================================
  // Challenge 3: Duplicate Emails & Email Validation
  // ==========================================================================
  describe('Challenge 3: Duplicate Emails & Format Boundaries', () => {
    it('3.1: Register duplicate email returns 409 Conflict with RFC 7807', async () => {
      const email = randomEmail();
      // First registration succeeds
      const first = await apiRequest('/auth/register', {
        method: 'POST',
        body: { name: 'Primeiro Dono', email, password: 'Password@123' },
      });
      assert.equal(first.status, 201);

      // Second registration with same email
      const second = await apiRequest('/auth/register', {
        method: 'POST',
        body: { name: 'Segundo Dono', email, password: 'Password@123' },
      });
      assert.equal(second.status, 409);
      assert.equal(second.error?.title, 'Conflito de Regra de Negócio');
      assert.ok(
        second.error?.detail?.toLowerCase().includes('email') ||
        second.error?.detail?.toLowerCase().includes('cadastrado') ||
        second.error?.detail?.toLowerCase().includes('cadastado')
      );
    });

    it('3.2: Register with invalid email syntax (no domain, no @) returns 400', async () => {
      const malformedEmails = ['userdomain', 'user@', '@nodomain.com', 'user@domain.'];
      for (const badEmail of malformedEmails) {
        const res = await apiRequest('/auth/register', {
          method: 'POST',
          body: {
            name: 'Invalid Email User',
            email: badEmail,
            password: 'Password@123',
          },
        });
        assert.equal(res.status, 400, `Expected 400 for bad email: ${badEmail}`);
        assert.ok(res.error?.invalidParams?.email, `invalidParams.email expected for ${badEmail}`);
      }
    });
  });

  // ==========================================================================
  // Challenge 4: Unauthorized Access & Multi-Tenant Security Isolation
  // ==========================================================================
  describe('Challenge 4: Unauthorized Access & Multi-Tenant Security Isolation', () => {
    it('4.1: Access protected endpoints without Authorization header returns 403', async () => {
      const endpoints = [
        { path: '/farms', method: 'GET' },
        { path: `/currais/${corralA.id}`, method: 'GET' },
        { path: `/currais/${corralA.id}/limpeza`, method: 'POST' },
        { path: `/currais/${corralA.id}/odor`, method: 'GET' },
      ];
      for (const ep of endpoints) {
        const res = await apiRequest(ep.path, { method: ep.method });
        assert.equal(res.status, 403, `Expected 403 for unauthenticated ${ep.method} ${ep.path}`);
      }
    });

    it('4.2: Access protected endpoints with fake / corrupted Bearer token returns 403', async () => {
      const res = await apiRequest('/farms', {
        headers: { Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.INVALID_TAMPERED.SIGNATURE' },
      });
      assert.equal(res.status, 403);
    });

    it('4.3: Tenant B cannot read Corral of Tenant A (403 Forbidden)', async () => {
      const res = await apiRequest(`/currais/${corralA.id}`, {
        token: tenantB.token,
      });
      assert.equal(res.status, 403);
      assert.equal(res.error?.title, 'Acesso Negado');
    });

    it('4.4: Tenant B cannot update Farm of Tenant A (403 Forbidden)', async () => {
      const res = await apiRequest(`/farms/${farmA.id}`, {
        method: 'PUT',
        token: tenantB.token,
        body: { name: 'Fazenda Invadida' },
      });
      assert.equal(res.status, 403);
      assert.equal(res.error?.title, 'Acesso Negado');
    });

    it('4.5: Tenant B cannot delete Farm of Tenant A (403 Forbidden)', async () => {
      const res = await apiRequest(`/farms/${farmA.id}`, {
        method: 'DELETE',
        token: tenantB.token,
      });
      assert.equal(res.status, 403);
    });

    it('4.6: Tenant B cannot register animal presence in Corral of Tenant A (403 Forbidden)', async () => {
      const res = await apiRequest(`/currais/${corralA.id}/presenca`, {
        method: 'POST',
        token: tenantB.token,
        body: {
          tagUid: animalA1.tagUid,
          typeEvent: 'ENTROU',
        },
      });
      assert.equal(res.status, 403);
    });

    it('4.7: Tenant B cannot trigger cleaning in Corral of Tenant A (403 Forbidden)', async () => {
      const res = await apiRequest(`/currais/${corralA.id}/limpeza`, {
        method: 'POST',
        token: tenantB.token,
        body: { secondsDuration: 10 },
      });
      assert.equal(res.status, 403);
    });

    it('4.8: Tenant B cannot view odor telemetry of Corral of Tenant A (403 Forbidden)', async () => {
      const res = await apiRequest(`/currais/${corralA.id}/odor`, {
        token: tenantB.token,
      });
      assert.equal(res.status, 403);
    });

    it('4.9: Tenant B cannot view or modify Animal of Tenant A (403 Forbidden)', async () => {
      const getRes = await apiRequest(`/animais/${animalA1.id}`, { token: tenantB.token });
      assert.equal(getRes.status, 403);

      const putRes = await apiRequest(`/animais/${animalA1.id}`, {
        method: 'PUT',
        token: tenantB.token,
        body: { name: 'Nome Hackeado', tagUid: animalA1.tagUid },
      });
      assert.equal(putRes.status, 403);

      const delRes = await apiRequest(`/animais/${animalA1.id}`, {
        method: 'DELETE',
        token: tenantB.token,
      });
      assert.equal(delRes.status, 403);
    });
  });

  // ==========================================================================
  // Challenge 5: 409 Biological Lock & Safety Interlock State Transitions
  // ==========================================================================
  describe('Challenge 5: 409 Biological Lock & Safety Interlock Determinism', () => {
    it('5.1: Biological Lock - Single animal entry blocks cleaning with 409 Conflict', async () => {
      // 1. Animal 1 enters corral
      const presenceRes = await apiRequest(`/currais/${corralA.id}/presenca`, {
        method: 'POST',
        token: tenantA.token,
        body: {
          tagUid: animalA1.tagUid,
          typeEvent: 'ENTROU',
        },
      });
      assert.equal(presenceRes.status, 201);

      // Verify metrics show 1 animal
      const metricsRes = await apiRequest(`/currais/${corralA.id}/metricas`, {
        token: tenantA.token,
      });
      assert.equal(metricsRes.status, 200);
      assert.ok(metricsRes.data.totalAnimaisNoCurral >= 1);

      // 2. Trigger cleaning -> MUST be blocked by biological lock
      const cleanRes = await apiRequest(`/currais/${corralA.id}/limpeza`, {
        method: 'POST',
        token: tenantA.token,
        body: { secondsDuration: 20 },
      });

      assert.equal(cleanRes.status, 409, 'Biological lock must reject with 409 Conflict');
      assert.equal(cleanRes.error?.title, 'Conflito de Regra de Negócio');
      assert.ok(
        cleanRes.error?.detail?.toLowerCase().includes('vaca no curral') ||
        cleanRes.error?.detail?.toLowerCase().includes('animal no curral') ||
        cleanRes.error?.detail?.toLowerCase().includes('curral'),
        `Expected biological lock message, received: ${cleanRes.error?.detail}`
      );
    });

    it('5.2: Multi-Animal Accumulation & Partial Exit - Lock persists while any animal remains', async () => {
      // Animal 2 also enters corral (now 2 animals inside)
      const enterRes2 = await apiRequest(`/currais/${corralA.id}/presenca`, {
        method: 'POST',
        token: tenantA.token,
        body: {
          tagUid: animalA2.tagUid,
          typeEvent: 'ENTROU',
        },
      });
      assert.equal(enterRes2.status, 201);

      // Verify 2 animals
      const metricsRes = await apiRequest(`/currais/${corralA.id}/metricas`, {
        token: tenantA.token,
      });
      assert.equal(metricsRes.data.totalAnimaisNoCurral, 2);

      // Animal 1 exits (partial exit)
      const exitRes1 = await apiRequest(`/currais/${corralA.id}/presenca`, {
        method: 'POST',
        token: tenantA.token,
        body: {
          tagUid: animalA1.tagUid,
          typeEvent: 'SAIU',
        },
      });
      assert.equal(exitRes1.status, 201);

      // 1 animal remains!
      const metricsAfterPartial = await apiRequest(`/currais/${corralA.id}/metricas`, {
        token: tenantA.token,
      });
      assert.equal(metricsAfterPartial.data.totalAnimaisNoCurral, 1);

      // Cleaning MUST still be blocked by biological lock because Animal 2 is still inside!
      const cleanRes = await apiRequest(`/currais/${corralA.id}/limpeza`, {
        method: 'POST',
        token: tenantA.token,
        body: { secondsDuration: 15 },
      });
      assert.equal(cleanRes.status, 409);
      assert.ok(
        cleanRes.error?.detail?.toLowerCase().includes('vaca no curral') ||
        cleanRes.error?.detail?.toLowerCase().includes('curral')
      );
    });

    it('5.3: Complete Exit releases Biological Lock (Transitions to Connectivity Lock when ESP32 offline)', async () => {
      // Animal 2 exits corral (now 0 animals inside)
      const exitRes2 = await apiRequest(`/currais/${corralA.id}/presenca`, {
        method: 'POST',
        token: tenantA.token,
        body: {
          tagUid: animalA2.tagUid,
          typeEvent: 'SAIU',
        },
      });
      assert.equal(exitRes2.status, 201);

      // Metrics show 0 animals
      const metricsRes = await apiRequest(`/currais/${corralA.id}/metricas`, {
        token: tenantA.token,
      });
      assert.equal(metricsRes.data.totalAnimaisNoCurral, 0);

      // Trigger cleaning: Biological lock MUST NOT trigger!
      // If ESP32 is offline, returns 409 for offline connectivity, NOT biological lock
      const cleanRes = await apiRequest(`/currais/${corralA.id}/limpeza`, {
        method: 'POST',
        token: tenantA.token,
        body: { secondsDuration: 15 },
      });

      assert.equal(cleanRes.status, 409);
      assert.ok(
        !cleanRes.error?.detail?.toLowerCase().includes('vaca no curral'),
        'Must NOT report biological lock when 0 animals in corral'
      );
      assert.ok(
        cleanRes.error?.detail?.toLowerCase().includes('offline') ||
        cleanRes.error?.detail?.toLowerCase().includes('comunicação') ||
        cleanRes.error?.detail?.toLowerCase().includes('dispositivo'),
        `Expected connectivity lock message, received: ${cleanRes.error?.detail}`
      );
    });
  });
});

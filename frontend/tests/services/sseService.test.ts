import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  subscribeToCorralStream,
  getCorralStreamUrl,
  sseService,
} from '../../src/services/sseService';
import { setToken } from '../../src/services/apiClient';
import { MockEventSource } from '../setup';
import type {
  SseConnectedData,
  CleanCmdResponseDTO,
  OdorTelemetryResponseDTO,
  CorralResponseDTO,
  AnimalEventResponseDTO,
  IdentifyPendencyResponseDTO,
} from '../../src/types/api';

describe('sseService - Server-Sent Events Real-Time Streaming', () => {
  beforeEach(() => {
    localStorage.clear();
    setToken(null);
    MockEventSource.instances = [];
  });

  afterEach(() => {
    MockEventSource.instances.forEach((inst) => inst.close());
    MockEventSource.instances = [];
    vi.restoreAllMocks();
  });

  describe('1. getCorralStreamUrl', () => {
    it('1.1: Generates direct corral stream URL without farmId and without token', () => {
      const url = getCorralStreamUrl(10);
      expect(url).toBe('/api/v1/currais/10/stream');
    });

    it('1.2: Generates nested farm-corral stream URL when farmId is provided', () => {
      const url = getCorralStreamUrl(42, 5);
      expect(url).toBe('/api/v1/farms/5/currais/42/stream');
    });

    it('1.3: Appends token query parameter when token is provided', () => {
      const url = getCorralStreamUrl(42, 5, 'jwt-secret-token-123');
      expect(url).toBe('/api/v1/farms/5/currais/42/stream?token=jwt-secret-token-123');
    });

    it('1.4: Correctly URL-encodes tokens with special characters', () => {
      const url = getCorralStreamUrl(10, null, 'token+with/special=chars');
      expect(url).toBe('/api/v1/currais/10/stream?token=token%2Bwith%2Fspecial%3Dchars');
    });
  });

  describe('2. subscribeToCorralStream - Event Dispatching & Callbacks', () => {
    it('2.1: Automatically uses active token from localStorage/apiClient when token option is not explicitly passed', () => {
      setToken('stored-session-token');

      const unsubscribe = subscribeToCorralStream({
        corralId: 99,
        farmId: 10,
      });

      expect(MockEventSource.instances.length).toBe(1);
      const instance = MockEventSource.instances[0];
      expect(instance.url).toBe('/api/v1/farms/10/currais/99/stream?token=stored-session-token');

      unsubscribe();
      expect(instance.readyState).toBe(2); // CLOSED
    });

    it('2.2: Dispatches "connected" event and invokes onConnected callback', async () => {
      const onConnectedSpy = vi.fn();
      const onOpenSpy = vi.fn();

      const unsubscribe = subscribeToCorralStream({
        corralId: 10,
        onConnected: onConnectedSpy,
        onOpen: onOpenSpy,
      });

      const instance = MockEventSource.instances[0];
      const payload: SseConnectedData = { corralId: 10, status: 'connected' };
      instance.emit('connected', payload);

      expect(onConnectedSpy).toHaveBeenCalledTimes(1);
      expect(onConnectedSpy).toHaveBeenCalledWith(payload);

      unsubscribe();
    });

    it('2.3: Dispatches "odor" telemetry event and invokes onOdor callback', () => {
      const onOdorSpy = vi.fn();

      const unsubscribe = subscribeToCorralStream({
        corralId: 10,
        onOdor: onOdorSpy,
      });

      const instance = MockEventSource.instances[0];
      const odorData: OdorTelemetryResponseDTO = {
        id: 501,
        corralId: 10,
        value: 480,
        instant: '2026-10-24T12:00:00',
      };

      instance.emit('odor', odorData);

      expect(onOdorSpy).toHaveBeenCalledTimes(1);
      expect(onOdorSpy).toHaveBeenCalledWith(odorData);

      unsubscribe();
    });

    it('2.4: Dispatches "presenca" animal event and invokes onPresenca callback', () => {
      const onPresencaSpy = vi.fn();

      const unsubscribe = subscribeToCorralStream({
        corralId: 10,
        onPresenca: onPresencaSpy,
      });

      const instance = MockEventSource.instances[0];
      const animalEvent: AnimalEventResponseDTO = {
        id: 1001,
        corralId: 10,
        corralName: 'Curral Principal',
        animalId: 7,
        animalName: 'Vaca Mimosa',
        tagUid: 'E280116060000204',
        typeEvent: 'ENTROU',
        eventOrigin: 'TAG',
        instant: '2026-10-24T12:01:00',
      };

      instance.emit('presenca', animalEvent);

      expect(onPresencaSpy).toHaveBeenCalledTimes(1);
      expect(onPresencaSpy).toHaveBeenCalledWith(animalEvent);

      unsubscribe();
    });

    it('2.5: Dispatches "pendencia" event and invokes onPendencia callback', () => {
      const onPendenciaSpy = vi.fn();

      const unsubscribe = subscribeToCorralStream({
        corralId: 10,
        onPendencia: onPendenciaSpy,
      });

      const instance = MockEventSource.instances[0];
      const pendencyData: IdentifyPendencyResponseDTO = {
        id: 301,
        corralId: 10,
        tagUid: 'UNKNOWN_RFID_99',
        typeEvent: 'ENTROU',
        instant: '2026-10-24T12:02:00',
        resolved: false,
        animalIdResolved: null,
        animalNameResolved: null,
        resolvedAt: null,
      };

      instance.emit('pendencia', pendencyData);

      expect(onPendenciaSpy).toHaveBeenCalledTimes(1);
      expect(onPendenciaSpy).toHaveBeenCalledWith(pendencyData);

      unsubscribe();
    });

    it('2.6: Dispatches "limpeza" event and invokes onLimpeza callback', () => {
      const onLimpezaSpy = vi.fn();

      const unsubscribe = subscribeToCorralStream({
        corralId: 10,
        onLimpeza: onLimpezaSpy,
      });

      const instance = MockEventSource.instances[0];
      const cleanCmd: CleanCmdResponseDTO = {
        id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
        corralId: 10,
        origin: 'MANUAL',
        state: 'CONCLUIDO',
        secondsDuration: 20,
        createdAt: '2026-10-24T12:03:00',
        mensagem: 'Bomba acionada e confirmada com sucesso!',
      };

      instance.emit('limpeza', cleanCmd);

      expect(onLimpezaSpy).toHaveBeenCalledTimes(1);
      expect(onLimpezaSpy).toHaveBeenCalledWith(cleanCmd);

      unsubscribe();
    });

    it('2.7: Dispatches "status" device event and invokes onStatus callback', () => {
      const onStatusSpy = vi.fn();

      const unsubscribe = subscribeToCorralStream({
        corralId: 10,
        onStatus: onStatusSpy,
      });

      const instance = MockEventSource.instances[0];
      const corralStatus: CorralResponseDTO = {
        id: 10,
        farmId: 1,
        name: 'Curral Principal',
        macAddress: '240AC4000110',
        cleanTime: '06:30:00',
        limitOdor: 400,
        pumpDurationSeconds: 30,
        deviceStatus: 'ONLINE',
        lastSeenAt: '2026-10-24T12:04:00',
      };

      instance.emit('status', corralStatus);

      expect(onStatusSpy).toHaveBeenCalledTimes(1);
      expect(onStatusSpy).toHaveBeenCalledWith(corralStatus);

      unsubscribe();
    });

    it('2.8: Robust parsing: Ignores malformed event payloads without throwing unhandled exceptions', () => {
      const onOdorSpy = vi.fn();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const unsubscribe = subscribeToCorralStream({
        corralId: 10,
        onOdor: onOdorSpy,
      });

      const instance = MockEventSource.instances[0];
      // Emite payload string que não é JSON válido
      instance.emit('odor', 'MALFORMED_NON_JSON_DATA{{{');

      expect(onOdorSpy).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[SSE] Falha ao desserializar payload JSON'),
        expect.anything(),
        expect.anything()
      );

      unsubscribe();
    });
  });

  describe('3. subscribeToCorralStream - Resilience, Error Handling & Reconnection', () => {
    it('3.1: Calls onError and onClose appropriately when unsubscribing', () => {
      const onErrorSpy = vi.fn();
      const onCloseSpy = vi.fn();

      const unsubscribe = subscribeToCorralStream({
        corralId: 10,
        onError: onErrorSpy,
        onClose: onCloseSpy,
      });

      const instance = MockEventSource.instances[0];
      const errorEvent = new Event('error');
      instance.onerror?.(errorEvent);
      expect(onErrorSpy).toHaveBeenCalledWith(errorEvent);

      unsubscribe();
      expect(onCloseSpy).toHaveBeenCalledTimes(1);
      expect(instance.readyState).toBe(2);
    });

    it('3.2: Reconnects automatically when connection drops and readyState is CLOSED', () => {
      vi.useFakeTimers();

      const unsubscribe = subscribeToCorralStream({
        corralId: 10,
        autoReconnect: true,
        reconnectDelayMs: 500,
      });

      expect(MockEventSource.instances.length).toBe(1);
      const firstInstance = MockEventSource.instances[0];

      // Simula erro e fechamento do stream
      firstInstance.close();
      firstInstance.onerror?.(new Event('error'));

      // Avança timer de reconexão
      vi.advanceTimersByTime(500);

      expect(MockEventSource.instances.length).toBe(2);
      const secondInstance = MockEventSource.instances[1];
      expect(secondInstance.url).toBe(firstInstance.url);

      unsubscribe();
      vi.useRealTimers();
    });

    it('3.3: Graceful fallback when EventSource is not supported in the runtime', () => {
      const originalES = (globalThis as any).EventSource;
      delete (globalThis as any).EventSource;
      delete (window as any).EventSource;

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const unsubscribe = subscribeToCorralStream({
        corralId: 10,
      });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[SSE] EventSource não é suportado neste ambiente')
      );
      expect(typeof unsubscribe).toBe('function');
      expect(() => unsubscribe()).not.toThrow();

      (globalThis as any).EventSource = originalES;
      (window as any).EventSource = originalES;
    });

    it('3.4: Reconnects using refreshed token when token getter function is used', () => {
      vi.useFakeTimers();
      let currentToken = 'initial-token-123';

      const unsubscribe = subscribeToCorralStream({
        corralId: 50,
        farmId: 12,
        token: () => currentToken,
        autoReconnect: true,
        reconnectDelayMs: 300,
      });

      expect(MockEventSource.instances.length).toBe(1);
      expect(MockEventSource.instances[0].url).toContain('token=initial-token-123');

      // Token renovado pelo backend/auth
      currentToken = 'refreshed-token-999';

      // Simula desconexão
      MockEventSource.instances[0].close();
      MockEventSource.instances[0].onerror?.(new Event('error'));

      // Dispara o timer de reconexão
      vi.advanceTimersByTime(300);

      expect(MockEventSource.instances.length).toBe(2);
      expect(MockEventSource.instances[1].url).toContain('token=refreshed-token-999');

      unsubscribe();
      vi.useRealTimers();
    });
  });
});

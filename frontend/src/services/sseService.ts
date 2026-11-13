/**
 * Real-time Server-Sent Events (SSE) client subscribing to named corral stream events
 * ({@code connected}, {@code odor}, {@code presenca}, {@code pendencia}, {@code limpeza}, {@code status})
 * with capped exponential-backoff reconnection and dynamic JWT resolution.
 */

import { getToken } from './apiClient';
import { getCorralStreamUrl } from './corralService';
export { getCorralStreamUrl };
import type {
  SseConnectedData,
  SseSubscriptionOptions,
  CleanCmdResponseDTO,
  OdorTelemetryResponseDTO,
  CorralResponseDTO,
  AnimalEventResponseDTO,
  IdentifyPendencyResponseDTO,
} from '../types/api';

function safeJsonParse<T>(rawData: unknown): T | null {
  if (rawData === null || rawData === undefined) return null;
  if (typeof rawData !== 'string') return rawData as T;
  try {
    return JSON.parse(rawData) as T;
  } catch (err) {
    console.warn('[SSE] Falha ao desserializar payload JSON do evento SSE:', rawData, err);
    return null;
  }
}

/** Resolves the environment's {@code EventSource} constructor (browser window or global test polyfill). */
function getEventSourceConstructor(): typeof EventSource | null {
  if (typeof window !== 'undefined' && window.EventSource) {
    return window.EventSource;
  }
  if (typeof globalThis !== 'undefined' && (globalThis as any).EventSource) {
    return (globalThis as any).EventSource;
  }
  return null;
}

/**
 * Opens an SSE subscription for a corral and binds listeners for all named domain events.
 *
 * <p>Reconnects automatically using 1.5x exponential backoff (capped at 15s up to {@code maxReconnectAttempts}),
 * re-evaluating token functions on every reconnect so refreshed JWTs are picked up.</p>
 *
 * @param options subscription target, event callbacks, and reconnection settings
 * @returns cleanup function that cancels pending timers and closes the active {@code EventSource}
 */
export function subscribeToCorralStream(options: SseSubscriptionOptions): () => void {
  const {
    corralId,
    farmId,
    token: customToken,
    onConnected,
    onLimpeza,
    onOdor,
    onStatus,
    onPresenca,
    onPendencia,
    onMessage,
    onOpen,
    onError,
    onClose,
    autoReconnect = true,
    reconnectDelayMs = 2500,
    maxReconnectAttempts = 10,
  } = options;

  let isSubscribed = true;
  let activeEventSource: EventSource | null = null;
  let reconnectTimer: any = null;
  let reconnectAttempts = 0;

  const EventSourceImpl = getEventSourceConstructor();

  if (!EventSourceImpl) {
    console.warn('[SSE] EventSource não é suportado neste ambiente. O dashboard operará com fallback via polling.');
    return () => {
      isSubscribed = false;
    };
  }

  const ES = EventSourceImpl;

  function connect() {
    if (!isSubscribed) return;

    const token =
      typeof customToken === 'function'
        ? customToken()
        : customToken !== undefined
        ? customToken
        : getToken();
    const streamUrl = getCorralStreamUrl(corralId, farmId, token);

    try {
      const es = new ES(streamUrl);
      activeEventSource = es;

      es.onopen = (event: Event) => {
        if (!isSubscribed) {
          es.close();
          return;
        }
        reconnectAttempts = 0;
        onOpen?.(event);
      };

      es.onerror = (event: Event) => {
        if (!isSubscribed) return;
        onError?.(event);

        if (autoReconnect && isSubscribed) {
          if (es.readyState === 2 /* CLOSED */ || es.readyState === 0 /* CONNECTING */) {
            es.close();
            activeEventSource = null;

            if (reconnectAttempts < maxReconnectAttempts) {
              reconnectAttempts++;
              const backoff = Math.min(reconnectDelayMs * Math.pow(1.5, reconnectAttempts - 1), 15000);
              clearTimeout(reconnectTimer);
              reconnectTimer = setTimeout(() => {
                if (isSubscribed) {
                  connect();
                }
              }, backoff);
            }
          }
        }
      };

      es.addEventListener('connected', (event: MessageEvent) => {
        if (!isSubscribed) return;
        const data = safeJsonParse<SseConnectedData>(event.data);
        if (data) {
          onConnected?.(data);
        }
      });

      es.addEventListener('odor', (event: MessageEvent) => {
        if (!isSubscribed) return;
        const data = safeJsonParse<OdorTelemetryResponseDTO>(event.data);
        if (data) {
          onOdor?.(data);
        }
      });

      es.addEventListener('presenca', (event: MessageEvent) => {
        if (!isSubscribed) return;
        const data = safeJsonParse<AnimalEventResponseDTO>(event.data);
        if (data) {
          onPresenca?.(data);
        }
      });

      es.addEventListener('pendencia', (event: MessageEvent) => {
        if (!isSubscribed) return;
        const data = safeJsonParse<IdentifyPendencyResponseDTO>(event.data);
        if (data) {
          onPendencia?.(data);
        }
      });

      es.addEventListener('limpeza', (event: MessageEvent) => {
        if (!isSubscribed) return;
        const data = safeJsonParse<CleanCmdResponseDTO>(event.data);
        if (data) {
          onLimpeza?.(data);
        }
      });

      es.addEventListener('status', (event: MessageEvent) => {
        if (!isSubscribed) return;
        const data = safeJsonParse<CorralResponseDTO>(event.data);
        if (data) {
          onStatus?.(data);
        }
      });

      if (onMessage) {
        es.onmessage = (event: MessageEvent) => {
          if (!isSubscribed) return;
          onMessage(event);
        };
      }
    } catch (err) {
      console.error('[SSE] Erro ao instanciar EventSource:', err);
      onError?.(err as any);
    }
  }

  connect();

  return () => {
    isSubscribed = false;
    clearTimeout(reconnectTimer);
    if (activeEventSource) {
      activeEventSource.close();
      activeEventSource = null;
    }
    onClose?.();
  };
}

export const sseService = {
  subscribeToCorralStream,
  getCorralStreamUrl,
};

export default sseService;

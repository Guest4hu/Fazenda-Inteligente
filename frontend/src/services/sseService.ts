/**
 * src/services/sseService.ts
 * Serviço de Server-Sent Events (SSE) para streaming reativo em tempo real do curral.
 * 
 * Conecta-se aos endpoints do Spring Boot:
 *   - /api/v1/currais/{corralId}/stream
 *   - /api/v1/farms/{farmId}/currais/{corralId}/stream
 * 
 * Eventos suportados:
 *   - 'connected': Confirmação de conexão SSE com { corralId, status }
 *   - 'odor': Telemetria de odor recebida do sensor MQ-135 (OdorTelemetryResponseDTO)
 *   - 'presenca': Movimentação de animais via RFID / trava biológica (AnimalEventResponseDTO)
 *   - 'pendencia': Pendências geradas para tags RFID desconhecidas (IdentifyPendencyResponseDTO)
 *   - 'limpeza': Comandos e status de acionamento de bomba d'água (CleanCmdResponseDTO)
 *   - 'status': Atualizações de conectividade e status do hardware ESP32 (CorralResponseDTO)
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

/**
 * Função utilitária para desserializar com segurança o payload JSON de eventos SSE.
 */
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

/**
 * Obtém a implementação de EventSource disponível no ambiente (browser ou teste).
 */
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
 * Inscreve-se no canal SSE em tempo real de um curral.
 * Suporta reconexão automática com backoff exponencial e limpeza resiliente de recursos.
 *
 * @param options Configurações e callbacks de eventos do stream.
 * @returns Função unsubscribe para cancelar a escuta e fechar a conexão.
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

    // Resgata o token de autenticação ativo (suporta getter dinâmico para renovação em reconexão)
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

        // Se o EventSource estiver fechado ou com erro de conexão, agenda reconexão controlada
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

      // 1. Evento 'connected'
      es.addEventListener('connected', (event: MessageEvent) => {
        if (!isSubscribed) return;
        const data = safeJsonParse<SseConnectedData>(event.data);
        if (data) {
          onConnected?.(data);
        }
      });

      // 2. Evento 'odor'
      es.addEventListener('odor', (event: MessageEvent) => {
        if (!isSubscribed) return;
        const data = safeJsonParse<OdorTelemetryResponseDTO>(event.data);
        if (data) {
          onOdor?.(data);
        }
      });

      // 3. Evento 'presenca'
      es.addEventListener('presenca', (event: MessageEvent) => {
        if (!isSubscribed) return;
        const data = safeJsonParse<AnimalEventResponseDTO>(event.data);
        if (data) {
          onPresenca?.(data);
        }
      });

      // 4. Evento 'pendencia'
      es.addEventListener('pendencia', (event: MessageEvent) => {
        if (!isSubscribed) return;
        const data = safeJsonParse<IdentifyPendencyResponseDTO>(event.data);
        if (data) {
          onPendencia?.(data);
        }
      });

      // 5. Evento 'limpeza'
      es.addEventListener('limpeza', (event: MessageEvent) => {
        if (!isSubscribed) return;
        const data = safeJsonParse<CleanCmdResponseDTO>(event.data);
        if (data) {
          onLimpeza?.(data);
        }
      });

      // 6. Evento 'status'
      es.addEventListener('status', (event: MessageEvent) => {
        if (!isSubscribed) return;
        const data = safeJsonParse<CorralResponseDTO>(event.data);
        if (data) {
          onStatus?.(data);
        }
      });

      // 7. Eventos de mensagem genérica
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

  // Inicia conexão inicial
  connect();

  // Função de desmontagem e encerramento
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

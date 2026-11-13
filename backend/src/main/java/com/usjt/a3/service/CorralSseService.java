package com.usjt.a3.service;

import com.usjt.a3.model.entity.Corral;
import com.usjt.a3.repository.CorralRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Manages Server-Sent Events (SSE) subscriptions per corral for pushing real-time updates
 * ({@code odor}, {@code presenca}, {@code limpeza}, {@code status}, {@code pendencia}) to connected clients.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CorralSseService {

    private final CorralRepository corralRepository;
    private final Map<Long, List<SseEmitter>> emittersByCorral = new ConcurrentHashMap<>();

    /**
     * Verifies user ownership and optional farm containment, registers a no-timeout {@link SseEmitter},
     * attaches lifecycle cleanup callbacks, and dispatches an initial {@code connected} event.
     *
     * @param corralId target corral identifier
     * @param farmId optional parent farm identifier for nested route validation
     * @param userId authenticated owner identifier
     * @return active {@link SseEmitter} bound to the corral channel
     */
    @Transactional(readOnly = true)
    public SseEmitter subscribe(Long corralId, Long farmId, Long userId) {
        Corral corral = corralRepository.findById(corralId)
                .orElseThrow(() -> new EntityNotFoundException("Curral não encontrado com ID: " + corralId));

        if (!corral.getFarm().getUser().getId().equals(userId)) {
            throw new SecurityException("Você não tem permissão para acompanhar eventos deste curral");
        }

        if (farmId != null && !corral.getFarm().getId().equals(farmId)) {
            throw new EntityNotFoundException("Curral não pertence à fazenda informada");
        }

        SseEmitter emitter = new SseEmitter(0L);
        List<SseEmitter> emitters = emittersByCorral.computeIfAbsent(
                corralId, id -> new CopyOnWriteArrayList<>()
        );
        emitters.add(emitter);

        Runnable removeCallback = () -> emitters.remove(emitter);
        emitter.onCompletion(removeCallback);
        emitter.onTimeout(removeCallback);
        emitter.onError(ex -> removeCallback.run());

        try {
            emitter.send(SseEmitter.event().name("connected").data(Map.of("corralId", corralId, "status", "connected")));
        } catch (IOException e) {
            emitters.remove(emitter);
        }

        return emitter;
    }

    /**
     * Subscribes to SSE updates for a corral without constraining by parent farm ID.
     *
     * @param corralId target corral identifier
     * @param userId authenticated owner identifier
     * @return active {@link SseEmitter}
     */
    public SseEmitter subscribe(Long corralId, Long userId) {
        return subscribe(corralId, null, userId);
    }

    /**
     * Broadcasts a named SSE event to all active subscribers of a corral, pruning disconnected emitters on failure.
     *
     * @param corralId target corral identifier
     * @param eventName SSE event name (e.g., {@code odor}, {@code presenca}, {@code limpeza}, {@code status}, {@code pendencia})
     * @param data JSON-serializable payload
     */
    public void sendEvent(Long corralId, String eventName, Object data) {
        List<SseEmitter> emitters = emittersByCorral.get(corralId);
        if (emitters == null || emitters.isEmpty()) {
            return;
        }

        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event().name(eventName).data(data));
            } catch (Exception e) {
                log.debug("Removendo conexão SSE inativa do curral ID {}: {}", corralId, e.getMessage());
                emitters.remove(emitter);
            }
        }
    }
}

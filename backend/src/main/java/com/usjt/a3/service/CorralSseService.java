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

@Slf4j
@Service
@RequiredArgsConstructor
public class CorralSseService {

    private final CorralRepository corralRepository;
    private final Map<Long, List<SseEmitter>> emittersByCorral = new ConcurrentHashMap<>();

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

    public SseEmitter subscribe(Long corralId, Long userId) {
        return subscribe(corralId, null, userId);
    }

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

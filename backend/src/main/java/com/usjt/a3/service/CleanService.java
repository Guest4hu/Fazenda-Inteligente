package com.usjt.a3.service;

import com.usjt.a3.dto.request.CleanCmdRequestDTO;
import com.usjt.a3.dto.response.CleanCmdResponseDTO;
import com.usjt.a3.mapper.CleanCmdMapper;
import com.usjt.a3.model.entity.CleanCmd;
import com.usjt.a3.model.entity.Corral;
import com.usjt.a3.model.enums.CleanOrigin;
import com.usjt.a3.model.enums.CleanState;
import com.usjt.a3.model.enums.ComandResult;
import com.usjt.a3.model.enums.DeviceStatus;
import com.usjt.a3.repository.AnimalRepository;
import com.usjt.a3.repository.CleanCmdRepository;
import com.usjt.a3.repository.CorralRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Orchestrates corral washing commands from REST, scheduled, and sensor triggers,
 * enforcing biological, physical concurrency, and device liveness safety locks.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class CleanService {

    private final CorralRepository corralRepository;
    private final AnimalRepository animalRepository;
    private final CleanCmdRepository cleanCmdRepository;
    private final CleanCmdMapper cleanCmdMapper;
    private final AckService ackService;
    private final CommandPublisher commandPublisher;

    @Autowired(required = false)
    private CorralSseService corralSseService;

    /**
     * Triggers a manual wash command on behalf of an authenticated farm owner.
     *
     * <p>Falls back to the corral's configured {@code pumpDurationSeconds} (or 30s) when duration is omitted.</p>
     *
     * @param corralId target corral identifier
     * @param userId authenticated owner identifier
     * @param request optional duration and origin overrides
     * @return finalized command execution summary
     */
    public CleanCmdResponseDTO triggerManualClean(Long corralId, Long userId, CleanCmdRequestDTO request) {
        log.info("Solicitação de limpeza manual recebida para o curral ID {} pelo usuário ID {}", corralId, userId);

        Corral corral = corralRepository.findById(corralId)
                .orElseThrow(() -> new EntityNotFoundException("Não foi encontrado este curral com ID: " + corralId));

        if (!corralRepository.existsByIdAndFarmUserId(corralId, userId)) {
            throw new SecurityException("Você não tem permissão para enviar comandos para esta fazenda");
        }

        Integer duration = (request != null && request.secondsDuration() != null)
                ? request.secondsDuration()
                : (corral.getPumpDurationSeconds() != null ? corral.getPumpDurationSeconds() : 30);

        CleanOrigin origin = (request != null && request.origin() != null)
                ? request.origin()
                : CleanOrigin.MANUAL;

        return executeCleanProcess(corral, origin, duration);
    }

    /**
     * Triggers an automated or event-driven wash resolved by the controller's normalized MAC address.
     *
     * @param macAddress normalized device MAC address
     * @param origin command origin (defaults to {@link CleanOrigin#AUTOMATICA} if null)
     * @param durationSeconds optional pump duration override in seconds
     * @return finalized command execution summary
     */
    public CleanCmdResponseDTO triggerMqttClean(String macAddress, CleanOrigin origin, Integer durationSeconds) {
        log.info("Solicitação de limpeza via MQTT/Sensor recebida para o dispositivo MAC {}", macAddress);

        Corral corral = corralRepository.findByMacAddress(macAddress)
                .orElseThrow(() -> new EntityNotFoundException("Nenhum curral cadastrado com o MAC Address: " + macAddress));

        Integer duration = (durationSeconds != null)
                ? durationSeconds
                : (corral.getPumpDurationSeconds() != null ? corral.getPumpDurationSeconds() : 30);
        CleanOrigin cleanOrigin = (origin != null) ? origin : CleanOrigin.AUTOMATICA;

        return executeCleanProcess(corral, cleanOrigin, duration);
    }

    /**
     * Core clean-execution pipeline shared by REST and MQTT callers.
     *
     * <p>Enforces three fail-fast locks before dispatching: (1) biological lock blocking washes while
     * any animal occupies the corral, (2) concurrency lock preventing simultaneous {@link CleanState#EM_ANDAMENTO}
     * commands, and (3) hardware liveness lock requiring {@link DeviceStatus#ONLINE} with a heartbeat within 60s.
     * Always transitions the command out of {@code EM_ANDAMENTO} on ACK timeout or failure and emits an SSE
     * {@code limpeza} event.</p>
     *
     * <p>Deliberately avoids {@code @Transactional} so blocking up to 10s inside {@link AckService#awaitAck(UUID)}
     * does not hold a HikariCP database connection; each repository {@code save} runs in its own atomic transaction.</p>
     *
     * @param corral validated target corral
     * @param origin trigger source
     * @param duration pump activation duration in seconds
     * @return command result reflecting hardware acknowledgment or timeout/failure
     */
    protected CleanCmdResponseDTO executeCleanProcess(Corral corral, CleanOrigin origin, Integer duration) {
        Long corralId = corral.getId();

        if (animalRepository.existsByCurrentCorralId(corralId)) {
            throw new IllegalStateException("Tem uma vaca no curral neste momento, não tem como acionar a bomba de limpeza");
        }

        if (cleanCmdRepository.existsByCorralIdAndCleanState(corralId, CleanState.EM_ANDAMENTO)) {
            throw new IllegalStateException("A bomba já está em andamento para este curral");
        }

        if(corral.getDeviceStatus() == DeviceStatus.OFFLINE || corral.getLastSeenAt() == null || corral.getLastSeenAt().isBefore(LocalDateTime.now().minusSeconds(60)) ) {
            throw new IllegalStateException("O dispositovo deste curral esta offline ou sem comunicação recente, Verifique a conexão antes de acionar a bomba");
        }

        CleanCmd cmd = cleanCmdMapper.toEntity(corral, origin, duration);
        CleanCmd savedCmd = cleanCmdRepository.save(cmd);
        UUID commandId = savedCmd.getId();
        log.info("Comando de limpeza {} registrado em EM_ANDAMENTO para o curral {}", commandId, corralId);

        ackService.registerAck(commandId, corral.getMacAddress());

        ComandResult status;
        try {
            commandPublisher.pumpAction(corral.getMacAddress(), commandId, duration);

            status = ackService.awaitAck(commandId);
        } catch (Exception e) {
            log.error("Falha ao comunicar com o broker MQTT para o dispositivo {}. Cancelando comando.", corral.getMacAddress(), e);
            status = ComandResult.FAILED;
        }

        if (status == ComandResult.SUCCESS) {
            savedCmd.setCleanState(CleanState.CONCLUIDO);
        } else {
            savedCmd.setCleanState(CleanState.CANCELADO);
        }
        cleanCmdRepository.save(savedCmd);
        log.info("Comando de limpeza {} finalizado com status {}", commandId, savedCmd.getCleanState());

        String message = (status == ComandResult.SUCCESS)
                ? "Bomba acionada e confirmada com sucesso!"
                : "Aviso: Dispositivo não respondeu a tempo ou reportou falha";

        CleanCmdResponseDTO dto = cleanCmdMapper.toDto(savedCmd, message);
        if (corralSseService != null) {
            corralSseService.sendEvent(corralId, "limpeza", dto);
        }
        return dto;
    }

    /**
     * Immediately commands the ESP32 pump to stop, clearing any active {@code EM_ANDAMENTO} locks first
     * before validating device liveness and awaiting hardware ACK for the stop command.
     *
     * @param corralId target corral identifier
     * @param userId authenticated owner identifier
     * @return recorded stop command DTO ({@code secondsDuration = 0}, {@link CleanState#CANCELADO})
     */
    public CleanCmdResponseDTO stopClean(Long corralId, Long userId) {
        log.info("Solicitação de parada da bomba recebida para o curral ID {} pelo usuário ID {}", corralId, userId);

        Corral corral = corralRepository.findById(corralId)
                .orElseThrow(() -> new EntityNotFoundException("Não foi encontrado este curral com ID: " + corralId));

        if (!corralRepository.existsByIdAndFarmUserId(corralId, userId)) {
            throw new SecurityException("Você não tem permissão para enviar comandos para esta fazenda");
        }

        cancelActiveCommands(corralId);

        if (corral.getDeviceStatus() == DeviceStatus.OFFLINE || corral.getLastSeenAt() == null || corral.getLastSeenAt().isBefore(LocalDateTime.now().minusSeconds(60))) {
            throw new IllegalStateException("O dispositivo deste curral está offline ou sem comunicação recente, verifique a conexão antes de acionar a bomba");
        }

        UUID stopCommandId = UUID.randomUUID();
        ackService.registerAck(stopCommandId, corral.getMacAddress());

        ComandResult status;
        try {
            commandPublisher.stopPump(corral.getMacAddress(), stopCommandId);
            status = ackService.awaitAck(stopCommandId);
        } catch (Exception e) {
            log.error("Falha ao comunicar parada via MQTT para o dispositivo {}. Cancelando comando.", corral.getMacAddress(), e);
            status = ComandResult.FAILED;
        }

        CleanCmd stopCmd = CleanCmd.builder()
                .corral(corral)
                .cleanOrigin(CleanOrigin.MANUAL)
                .cleanState(CleanState.CANCELADO)
                .secondsDuration(0)
                .build();
        CleanCmd savedStopCmd = cleanCmdRepository.save(stopCmd);

        String message = (status == ComandResult.SUCCESS)
                ? "Bomba parada e confirmada com sucesso!"
                : "Aviso: Dispositivo não respondeu ao comando de parada a tempo";

        CleanCmdResponseDTO dto = cleanCmdMapper.toDto(savedStopCmd, message);
        if (corralSseService != null) {
            corralSseService.sendEvent(corralId, "limpeza", dto);
        }
        return dto;
    }

    private void cancelActiveCommands(Long corralId) {
        List<CleanCmd> emAndamento = cleanCmdRepository.findByCorralIdOrderByCreatedAtDesc(corralId)
                .stream()
                .filter(c -> c.getCleanState() == CleanState.EM_ANDAMENTO)
                .toList();
        for (CleanCmd cmd : emAndamento) {
            cmd.setCleanState(CleanState.CANCELADO);
            cleanCmdRepository.save(cmd);
        }
    }

    /**
     * Backward-compatible alias delegating to {@link #triggerManualClean(Long, Long, CleanCmdRequestDTO)}.
     *
     * @param corralId target corral identifier
     * @param userId   authenticated owner identifier
     * @param request  optional wash request payload specifying origin and duration
     * @return persisted wash command DTO with final acknowledgment state
     */
    public CleanCmdResponseDTO createCleanCMD(Long corralId, Long userId, CleanCmdRequestDTO request) {
        return triggerManualClean(corralId, userId, request);
    }

    /**
     * Lists cleaning commands executed for a corral owned by the requesting user, ordered newest-first.
     *
     * @param corralId target corral identifier
     * @param userId authenticated owner identifier
     * @return chronological command history
     */
    public List<CleanCmdResponseDTO> listCleanHistory(Long corralId, Long userId) {
        if (!corralRepository.existsById(corralId)) {
            throw new EntityNotFoundException("Não foi encontrado este curral com ID: " + corralId);
        }

        if (!corralRepository.existsByIdAndFarmUserId(corralId, userId)) {
            throw new SecurityException("Você não tem permissão para visualizar o histórico deste curral");
        }

        return cleanCmdRepository.findByCorralIdOrderByCreatedAtDesc(corralId)
                .stream()
                .map(cleanCmdMapper::toDTO)
                .toList();
    }
}

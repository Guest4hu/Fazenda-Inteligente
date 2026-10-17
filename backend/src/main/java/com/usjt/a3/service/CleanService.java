package com.usjt.a3.service;

import com.usjt.a3.dto.request.CleanCmdRequestDTO;
import com.usjt.a3.dto.response.CleanCmdResponseDTO;
import com.usjt.a3.mapper.CleanCmdMapper;
import com.usjt.a3.model.entity.CleanCmd;
import com.usjt.a3.model.entity.Corral;
import com.usjt.a3.model.enums.CleanOrigin;
import com.usjt.a3.model.enums.CleanState;
import com.usjt.a3.model.enums.ComandResult;
import com.usjt.a3.repository.AnimalRepository;
import com.usjt.a3.repository.CleanCmdRepository;
import com.usjt.a3.repository.CorralRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.UUID;

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

    /**
     * 1. GATILHO MANUAL (Via API REST / Usuário Logado)
     * Responsável por validar se o usuário é proprietário da fazenda
     * e converter a requisição HTTP em parâmetros de limpeza.
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
                : corral.getPumpDurationSeconds();

        CleanOrigin origin = (request != null && request.origin() != null)
                ? request.origin()
                : CleanOrigin.MANUAL;

        return executeCleanProcess(corral, origin, duration);
    }

    /**
     * 2. GATILHO VIA MQTT / DISPOSITIVO (Automação de Sensores / Eventos IoT)
     * Responsável por validar o dispositivo através do seu MAC Address
     * quando um gatilho autônomo (ex: sensor de odor) solicitar a lavagem.
     */
    public CleanCmdResponseDTO triggerMqttClean(String macAddress, CleanOrigin origin, Integer durationSeconds) {
        log.info("Solicitação de limpeza via MQTT/Sensor recebida para o dispositivo MAC {}", macAddress);

        Corral corral = corralRepository.findByMacAddress(macAddress)
                .orElseThrow(() -> new EntityNotFoundException("Nenhum curral cadastrado com o MAC Address: " + macAddress));

        Integer duration = (durationSeconds != null) ? durationSeconds : corral.getPumpDurationSeconds();
        CleanOrigin cleanOrigin = (origin != null) ? origin : CleanOrigin.AUTOMATICA;

        return executeCleanProcess(corral, cleanOrigin, duration);
    }

    /**
     * 3. NÚCLEO COMUM DE EXECUÇÃO
     * Centraliza as travas de segurança físicas do curral, a persistência
     * da ordem de serviço e a sincronização do ACK com o hardware.
     *
     * NOTA DE ARQUITETURA: Não usamos @Transactional neste método principal
     * para não reter conexões do pool de banco (HikariCP) durante o awaitAck (até 10s).
     * O Spring Data gerencia transações atômicas pontuais em cada save().
     */
    protected CleanCmdResponseDTO executeCleanProcess(Corral corral, CleanOrigin origin, Integer duration) {
        Long corralId = corral.getId();

        // Trava 1: Segurança biológica - presença de animais no curral
        if (animalRepository.existsByCurrentCorralId(corralId)) {
            throw new IllegalStateException("Tem uma vaca no curral neste momento, não tem como acionar a bomba de limpeza");
        }

        // Trava 2: Concorrência física - curral já possui bomba em andamento
        if (cleanCmdRepository.existsByCorralIdAndCleanState(corralId, CleanState.EM_ANDAMENTO)) {
            throw new IllegalStateException("A bomba já está em andamento para este curral");
        }

        // Salva comando inicial como EM_ANDAMENTO (o Hibernate gera o UUID automaticamente no persist)
        CleanCmd cmd = CleanCmd.builder()
                .corral(corral)
                .cleanOrigin(origin)
                .cleanState(CleanState.EM_ANDAMENTO)
                .secondsDuration(duration)
                .build();

        CleanCmd savedCmd = cleanCmdRepository.save(cmd);
        UUID commandId = savedCmd.getId();
        log.info("Comando de limpeza {} registrado em EM_ANDAMENTO para o curral {}", commandId, corralId);

        // Registra o ID no monitor de ACK em memória antes de disparar o MQTT
        ackService.registerAck(commandId, corral.getMacAddress());

        ComandResult status;
        try {
            // Dispara comando via MQTT para o ESP32 / Wokwi
            commandPublisher.pumpAction(corral.getMacAddress(), commandId, duration);

            // Aguarda a resposta do dispositivo (até 10 segundos) sem prender conexão de banco
            status = ackService.awaitAck(commandId);
        } catch (Exception e) {
            log.error("Falha ao comunicar com o broker MQTT para o dispositivo {}. Cancelando comando.", corral.getMacAddress(), e);
            status = ComandResult.FAILED;
        }

        // Garante a transição de estado mesmo se houver falha de rede ou timeout,
        // liberando a trava de concorrência física do curral
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

        return cleanCmdMapper.toDto(savedCmd, message);
    }

    /**
     * Mantém compatibilidade com chamadas anteriores
     */
    public CleanCmdResponseDTO createCleanCMD(Long corralId, Long userId, CleanCmdRequestDTO request) {
        return triggerManualClean(corralId, userId, request);
    }
}

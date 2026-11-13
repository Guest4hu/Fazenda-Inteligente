package com.usjt.a3.service;

import com.usjt.a3.dto.response.OdorTelemetryResponseDTO;
import com.usjt.a3.mapper.OdorTelemetryMapper;
import com.usjt.a3.model.entity.Corral;
import com.usjt.a3.model.enums.CleanOrigin;
import com.usjt.a3.model.enums.DeviceStatus;
import com.usjt.a3.repository.CorralRepository;
import com.usjt.a3.repository.OdorTelemetryRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Ingests MQ-135 odor ADC readings and optional DHT telemetry, updates device heartbeat state,
 * streams updates over SSE, and triggers threshold-based automatic cleaning.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OdorService {
    private final CorralRepository corralRepository;
    private final OdorTelemetryRepository odorTelemetryRepository;
    private final CleanService cleanService;
    private final OdorTelemetryMapper  odorTelemetryMapper;

    @Autowired(required = false)
    private CorralSseService corralSseService;

    /**
     * Processes legacy odor-only telemetry without ambient temperature or humidity fields.
     *
     * @param macAddress normalized device MAC address
     * @param value raw ADC odor reading
     */
    public void processTelemetry(String macAddress, Integer value) {
        processTelemetry(macAddress, value, null, null);
    }

    /**
     * Persists a valid odor telemetry sample, marks the corral {@link DeviceStatus#ONLINE} with a fresh
     * {@code lastSeenAt} heartbeat, broadcasts an SSE {@code odor} event, and initiates a {@link CleanOrigin#EVENTO}
     * wash if {@code value} meets or exceeds the corral's {@code limitOdor}.
     *
     * <p>Safety lock conflicts from {@link CleanService} (e.g., animal inside) are caught so telemetry persistence succeeds.</p>
     *
     * @param macAddress normalized device MAC address
     * @param value raw ADC odor reading (must be non-null and non-negative)
     * @param temperature optional ambient temperature in Celsius
     * @param humidity optional relative humidity percentage
     */
    public void processTelemetry(String macAddress, Integer value, Double temperature, Double humidity) {
        if (value == null || value < 0) {
            log.warn("Telemetria de odor descartada: valor inválido para o curral {}", macAddress);
            return;
        }

        Optional<Corral> corralOpt = corralRepository.findByMacAddress(macAddress);
        if (corralOpt.isEmpty()) {
            log.warn("Telemetria de odor recebida de curral não cadastrado: {}", macAddress);
            return;
        }

        Corral corral = corralOpt.get();
        corral.setDeviceStatus(DeviceStatus.ONLINE);
        corral.setLastSeenAt(LocalDateTime.now());
        corralRepository.save(corral);

        var savedTelemetry = odorTelemetryRepository.save(odorTelemetryMapper.toEntity(corral, value, temperature, humidity));
        if (corralSseService != null && odorTelemetryMapper != null) {
            corralSseService.sendEvent(corral.getId(), "odor", odorTelemetryMapper.toDTO(savedTelemetry));
        }

        if (corral.getLimitOdor() != null && value >= corral.getLimitOdor()) {
            try {
                cleanService.triggerMqttClean(macAddress, CleanOrigin.EVENTO, null);
            } catch (IllegalStateException e) {
                log.info("Limpeza por evento adiada para o curral {}: {}", macAddress, e.getMessage());
            } catch (Exception e) {
                log.error("Erro inesperado ao disparar limpeza por evento para o curral {}: {}", macAddress, e.getMessage());
            }
        }
    }

    /**
     * Returns the 30 most recent odor telemetry samples for a corral owned by the requesting user.
     *
     * @param corralId target corral identifier
     * @param userId authenticated owner identifier
     * @return telemetry DTOs ordered newest-first
     */
    public List<OdorTelemetryResponseDTO> listLatestTelemetries(Long corralId, Long userId) {
        if (!corralRepository.existsById(corralId)) {
            throw new EntityNotFoundException("Curral não encontrado com ID: " + corralId);
        }

        if (!corralRepository.existsByIdAndFarmUserId(corralId, userId)) {
            throw new SecurityException("Você não tem permissão para visualizar a telemetria deste curral");
        }

        return odorTelemetryMapper.toDTOList(
                odorTelemetryRepository.findTop30ByCorralIdOrderByInstantDesc(corralId)
        );
    }
}

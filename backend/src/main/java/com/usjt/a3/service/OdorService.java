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

    public void processTelemetry(String macAddress, Integer value) {
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

        var savedTelemetry = odorTelemetryRepository.save(odorTelemetryMapper.toEntity(corral, value));
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

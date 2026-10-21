package com.usjt.a3.service;

import com.usjt.a3.mapper.OdorTelemetryMapper;
import com.usjt.a3.model.entity.Corral;
import com.usjt.a3.model.entity.OdorTelemetry;
import com.usjt.a3.model.enums.CleanOrigin;
import com.usjt.a3.repository.CorralRepository;
import com.usjt.a3.repository.OdorTelemetryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class OdorService {
    private final CorralRepository corralRepository;
    private final OdorTelemetryRepository odorTelemetryRepository;
    private final CleanService cleanService;
    private final OdorTelemetryMapper  odorTelemetryMapper;

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
        odorTelemetryRepository.save(odorTelemetryMapper.toEntity(corral, value));

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
}

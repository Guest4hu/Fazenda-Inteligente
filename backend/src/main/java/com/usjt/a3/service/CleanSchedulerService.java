package com.usjt.a3.service;

import com.usjt.a3.model.entity.Corral;
import com.usjt.a3.model.enums.CleanOrigin;
import com.usjt.a3.repository.CorralRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class CleanSchedulerService {

    private final CorralRepository corralRepository;
    private final CleanService cleanService;

    /**
     * Executa no segundo 0 de cada minuto para verificar se há currais
     * com horário de limpeza automática programado (cleanTime) para o minuto atual.
     */
    @Scheduled(cron = "0 * * * * *")
    public void executeScheduledCleanings() {
        LocalTime now = LocalTime.now().truncatedTo(ChronoUnit.MINUTES);
        List<Corral> scheduledCorrals = corralRepository.findByCleanTimeIsNotNull();

        for (Corral corral : scheduledCorrals) {
            LocalTime targetTime = corral.getCleanTime().truncatedTo(ChronoUnit.MINUTES);
            if (targetTime.equals(now)) {
                log.info("Iniciando limpeza automática agendada ({}) para o curral '{}' (ID: {}, MAC: {})",
                        targetTime, corral.getName(), corral.getId(), corral.getMacAddress());
                try {
                    cleanService.triggerMqttClean(
                            corral.getMacAddress(),
                            CleanOrigin.AUTOMATICA,
                            corral.getPumpDurationSeconds()
                    );
                } catch (IllegalStateException e) {
                    log.warn("Limpeza agendada adiada/cancelada para o curral ID {}: {}", corral.getId(), e.getMessage());
                } catch (Exception e) {
                    log.error("Erro inesperado na limpeza agendada do curral ID {}", corral.getId(), e);
                }
            }
        }
    }
}

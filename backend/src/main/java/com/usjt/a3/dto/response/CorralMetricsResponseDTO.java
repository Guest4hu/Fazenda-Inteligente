package com.usjt.a3.dto.response;

import com.usjt.a3.model.enums.DeviceStatus;

import java.time.LocalDateTime;

public record CorralMetricsResponseDTO(
        Long corralId,
        String corralName,
        Long farmId,
        String farmName,
        long totalAnimaisNoCurral,
        long totalAnimaisNaFazenda,
        long limpezasHojeTotal,
        long limpezasHojeManual,
        long limpezasHojeOdor,
        long limpezasHojeAutomatica,
        DeviceStatus deviceStatus,
        LocalDateTime lastSeenAt,
        long pendenciasAbertas
) {}

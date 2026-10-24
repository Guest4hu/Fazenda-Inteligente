package com.usjt.a3.mapper;

import com.usjt.a3.dto.request.CorralRequestDTO;
import com.usjt.a3.dto.response.CorralMetricsResponseDTO;
import com.usjt.a3.dto.response.CorralResponseDTO;
import com.usjt.a3.model.entity.Corral;
import com.usjt.a3.model.entity.Farm;
import com.usjt.a3.model.enums.DeviceStatus;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Component
public class CorralMapper {

    private static final long HEARTBEAT_TIMEOUT_SECONDS = 60L;

    public CorralResponseDTO toCorralResponseDTO(Corral corral) {
        if (corral == null) {
            return null;
        }

        DeviceStatus effectiveStatus = resolveEffectiveStatus(corral);

        return new CorralResponseDTO(
                corral.getId(),
                corral.getFarm().getId(),
                corral.getName(),
                corral.getMacAddress(),
                corral.getCleanTime(),
                corral.getLimitOdor(),
                corral.getPumpDurationSeconds(),
                effectiveStatus,
                corral.getLastSeenAt()
        );
    }

    public Corral toEntity(CorralRequestDTO requestDTO, Farm farm) {
        if (requestDTO == null ) {
            return null;
        }

        Integer odor = (requestDTO.limitOdor() != null) ? requestDTO.limitOdor() : 400;
        Integer duration = (requestDTO.pumpDurationSeconds() != null) ? requestDTO.pumpDurationSeconds() : 30;

        return Corral.builder()
                .farm(farm)
                .name(requestDTO.name())
                .cleanTime(requestDTO.cleanTime())
                .macAddress(requestDTO.macAddress())
                .limitOdor(odor)
                .pumpDurationSeconds(duration)
                .deviceStatus(DeviceStatus.OFFLINE)
                .build();
    }

    public DeviceStatus resolveEffectiveStatus(Corral corral) {
        if (corral == null || corral.getDeviceStatus() == null || corral.getDeviceStatus() == DeviceStatus.OFFLINE) {
            return DeviceStatus.OFFLINE;
        }
        if (corral.getLastSeenAt() == null) {
            return DeviceStatus.OFFLINE;
        }
        if (corral.getLastSeenAt().isBefore(LocalDateTime.now().minusSeconds(HEARTBEAT_TIMEOUT_SECONDS))) {
            return DeviceStatus.OFFLINE;
        }
        return DeviceStatus.ONLINE;
    }

    public CorralMetricsResponseDTO toCorralMetricsResponseDTO(
            Corral corral,
            long totalAnimaisNoCurral,
            long totalAnimaisNaFazenda,
            long limpezasHojeTotal,
            long limpezasHojeManual,
            long limpezasHojeOdor,
            long limpezasHojeAutomatica,
            long pendenciasAbertas
    ) {
        if (corral == null) {
            return null;
        }

        DeviceStatus effectiveStatus = resolveEffectiveStatus(corral);

        return new CorralMetricsResponseDTO(
                corral.getId(),
                corral.getName(),
                corral.getFarm().getId(),
                corral.getFarm().getName(),
                totalAnimaisNoCurral,
                totalAnimaisNaFazenda,
                limpezasHojeTotal,
                limpezasHojeManual,
                limpezasHojeOdor,
                limpezasHojeAutomatica,
                effectiveStatus,
                corral.getLastSeenAt(),
                pendenciasAbertas
        );
    }
}

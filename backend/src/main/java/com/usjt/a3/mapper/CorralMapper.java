package com.usjt.a3.mapper;

import com.usjt.a3.dto.request.CorralRequestDTO;
import com.usjt.a3.dto.response.CorralMetricsResponseDTO;
import com.usjt.a3.dto.response.CorralResponseDTO;
import com.usjt.a3.model.entity.Corral;
import com.usjt.a3.model.entity.Farm;
import com.usjt.a3.model.enums.DeviceStatus;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

/**
 * Maps {@link Corral} entities to DTOs while computing effective online status and applying default operational parameters.
 */
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

    /**
     * Instantiates a new {@link Corral} defaulting to {@link DeviceStatus#OFFLINE},
     * an odor threshold of {@code 400}, and a {@code 30}-second pump cycle when omitted.
     *
     * @param requestDTO validated corral creation payload
     * @param farm       owning farm entity
     * @return new unpersisted {@link Corral} entity, or {@code null} if {@code requestDTO} is {@code null}
     */
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

    /**
     * Computes effective controller connectivity, degrading {@link DeviceStatus#ONLINE} to
     * {@link DeviceStatus#OFFLINE} if {@code lastSeenAt} is null or older than {@value #HEARTBEAT_TIMEOUT_SECONDS}s.
     *
     * @param corral corral entity to inspect
     * @return effective {@link DeviceStatus} accounting for heartbeat expiration
     */
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

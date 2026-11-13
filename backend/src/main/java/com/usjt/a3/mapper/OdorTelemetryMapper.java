package com.usjt.a3.mapper;

import com.usjt.a3.dto.response.OdorTelemetryResponseDTO;
import com.usjt.a3.model.entity.Corral;
import com.usjt.a3.model.entity.OdorTelemetry;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class OdorTelemetryMapper {
    public OdorTelemetry toEntity(Corral corral, Integer value, Double temperature, Double humidity) {
        return OdorTelemetry.builder()
                .corral(corral)
                .value(value)
                .temperature(temperature)
                .humidity(humidity)
                .build();
    }

    public OdorTelemetry toEntity(Corral corral, Integer value) {
        return toEntity(corral, value, null, null);
    }

    public OdorTelemetryResponseDTO toDTO(OdorTelemetry odorTelemetry) {
        if (odorTelemetry == null) {
            return null;
        }
        return new OdorTelemetryResponseDTO(
                odorTelemetry.getId(),
                odorTelemetry.getCorral().getId(),
                odorTelemetry.getValue(),
                odorTelemetry.getInstant(),
                odorTelemetry.getTemperature(),
                odorTelemetry.getHumidity()
        );
    }

    public List<OdorTelemetryResponseDTO> toDTOList(List<OdorTelemetry> odorTelemetries) {
        if (odorTelemetries == null) return List.of();
        return odorTelemetries.stream().map(this::toDTO).toList();
    }
}

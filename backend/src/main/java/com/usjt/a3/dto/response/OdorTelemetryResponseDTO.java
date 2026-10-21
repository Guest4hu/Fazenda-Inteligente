package com.usjt.a3.dto.response;

import java.time.LocalDateTime;

public record OdorTelemetryResponseDTO(
        Long id,
        Long corralId,
        Integer value,
        LocalDateTime instant
) {
}

package com.usjt.a3.dto.response;

import java.time.LocalTime;

public record CorralResponseDTO(
        Long id,
        Long farmId,
        String name,
        String macAddress,
        LocalTime cleanTime,
        Integer limitOdor,
        Integer pumpDurationSeconds
) {
}
